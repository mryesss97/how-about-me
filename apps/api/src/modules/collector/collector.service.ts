import { Inject, Injectable, Optional } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { AppError } from "../../common/errors/app.error";
import type { RetryPolicy } from "../../common/retry/retry.policy";
import { retryPolicyFromConfig } from "../../common/retry/retry.policy";
import { withRetry } from "../../common/retry/with-retry";
import { MetricsService, type ProviderOutcome } from "../../common/metrics/metrics.service";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import type { ClaimedQuery, CollectorRunner, RunOutcome, RunStatus } from "../../jobs/collector-runner";
import {
  SOCIAL_DISCOVERY_PROVIDER,
  type SearchPage,
  type SocialDiscoveryProvider,
} from "../integrations/threads/social-discovery.provider";
import { IntegrationHealthService } from "../integrations/integration-health.service";
import { THREADS_TOKEN_SOURCE, type ThreadsTokenSource } from "../integrations/threads/threads-token.source";
import { SyncJobRecorder, type ProviderUsage } from "../sync-jobs/sync-job.recorder";
import { IngestionService } from "./ingestion.service";
import { normalizePage } from "./post-normalizer";
import { computeWindow } from "./window.calculator";

/** Optional retry-policy overrides (tests inject a no-op `sleep`). */
export const COLLECTOR_RETRY_OVERRIDES = Symbol("COLLECTOR_RETRY_OVERRIDES");

type Totals = {
  pages: number;
  fetched: number;
  inserted: number;
  updated: number;
  duplicated: number;
  invalid: number;
};

/**
 * One collector run for a claimed query — docs/02-architecture/06-ingestion-pipeline.md §5
 * (FR-073 pagination, FR-080 counters, FR-087 partial, FR-089 rate-limit metadata, BR-014).
 *
 * Schedule state (`next_run_at`, `consecutive_failures`, `last_error_*`, lock release) belongs to the
 * scheduler's `completeRun`; this service owns `sync_jobs` and `last_successful_sync_at`.
 */
@Injectable()
export class CollectorService implements CollectorRunner {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(SOCIAL_DISCOVERY_PROVIDER) private readonly provider: SocialDiscoveryProvider,
    @Inject(THREADS_TOKEN_SOURCE) private readonly tokens: ThreadsTokenSource,
    private readonly ingestion: IngestionService,
    private readonly recorder: SyncJobRecorder,
    private readonly health: IntegrationHealthService,
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
    @Optional() @Inject(COLLECTOR_RETRY_OVERRIDES) private readonly retryOverrides: Partial<RetryPolicy> | null = null,
  ) {
    this.logger.setContext(CollectorService.name);
  }

  async run(claimed: ClaimedQuery, signal?: AbortSignal): Promise<RunOutcome> {
    const query = await this.prisma.listeningQuery.findFirst({ where: { id: claimed.id, deletedAt: null } });
    if (!query)
      return { status: "failed", completedAt: new Date(), errorCode: "NOT_FOUND", errorMessage: "Query not found" };

    const computed = computeWindow(query, new Date(), { maxWindowDays: this.cfg.COLLECTOR_MAX_WINDOW_DAYS });
    const job = await this.recorder.start({
      projectId: query.projectId,
      queryId: query.id,
      queuedJobId: claimed.manualJobId,
      searchType: query.scheduledSearchType,
      searchMode: query.searchMode,
      windowSince: computed.since,
      windowUntil: computed.until,
      workerId: claimed.workerId,
    });
    // BR-008 / T-140: the job's search type wins (a backfill may run TOP).
    const searchType = job.searchType;
    const since = job.windowSince ?? computed.since;
    const until = job.windowUntil ?? computed.until;
    const ingestionQuery = {
      id: query.id,
      projectId: query.projectId,
      platform: "threads" as const,
      includeTerms: query.includeTerms,
      excludeTerms: query.excludeTerms,
    };

    const totals: Totals = { pages: 0, fetched: 0, inserted: 0, updated: 0, duplicated: 0, invalid: 0 };
    let cursor: string | undefined = job.lastCursor ?? undefined; // retry resumes after the last committed page
    let error: unknown = null;
    let capped = false;

    try {
      const ctx = {
        accessToken: await this.tokens.getAccessToken(query.projectId),
        requestId: job.id,
        projectId: query.projectId,
      };
      for (;;) {
        if (totals.pages >= this.cfg.COLLECTOR_MAX_PAGES_PER_JOB) {
          capped = true; // TC-COL-008: more pages remain, `last_cursor` lets a retry resume
          break;
        }
        if (signal?.aborted) throw new AppError("INTERNAL", "Run aborted (worker shutdown)");

        let attempts = 0;
        let rateLimited = 0;
        let page: SearchPage;
        try {
          page = await withRetry(
            async (attempt) => {
              attempts = attempt;
              const started = Date.now();
              try {
                const res = await this.provider.search(
                  {
                    query: query.queryValue,
                    searchMode: query.searchMode,
                    searchType,
                    since,
                    until,
                    limit: this.cfg.COLLECTOR_PAGE_LIMIT,
                    ...(cursor ? { cursor } : {}),
                  },
                  ctx,
                );
                this.metrics.observeProviderRequest(this.provider.platform, "ok", Date.now() - started);
                return res;
              } catch (err: unknown) {
                this.metrics.observeProviderRequest(this.provider.platform, providerOutcome(err), Date.now() - started);
                throw err;
              }
            },
            {
              ...retryPolicyFromConfig(this.cfg, this.retryOverrides ?? {}),
              onRetry: (info) => {
                if (info.code === "THREADS_RATE_LIMITED" || info.fromRetryAfter) {
                  rateLimited++;
                  this.metrics.incRateLimit(this.provider.platform);
                }
              },
            },
          );
        } catch (err: unknown) {
          await this.recorder.recordFailedAttempts(job.id, attempts, rateLimited);
          throw err;
        }

        const { valid, invalid } = normalizePage(page.items);
        const nextCursor = page.nextCursor ?? null;
        const result = await this.ingestion.ingestPage(ingestionQuery, valid, (tx, r) =>
          this.recorder.recordPageTx(tx, job.id, {
            fetched: page.items.length,
            inserted: r.inserted,
            updated: r.updated,
            duplicated: r.duplicated,
            invalid: invalid.length,
            excluded: r.excluded,
            providerRequests: attempts,
            rateLimitEvents: rateLimited,
            providerUsage: toProviderUsage(page),
            lastCursor: nextCursor,
          }),
        );
        totals.pages++;
        totals.fetched += page.items.length;
        totals.inserted += result.inserted;
        totals.updated += result.updated;
        totals.duplicated += result.duplicated;
        totals.invalid += invalid.length;
        this.metrics.addRecords("fetched", page.items.length);
        this.metrics.addRecords("inserted", result.inserted);
        this.metrics.addRecords("updated", result.updated);
        this.metrics.addRecords("duplicated", result.duplicated);
        this.metrics.addRecords("invalid", invalid.length);
        this.metrics.addRecords("excluded", result.excluded);

        if (!nextCursor) break;
        cursor = nextCursor;
        // RECENT is newest-first: once a page reaches past `since`, the window is covered (doc 06 §5).
        if (searchType === "RECENT" && valid.some((p) => p.publishedAt < since)) break;
      }
    } catch (err: unknown) {
      error = err;
    }

    const status: RunStatus = error === null && !capped ? "success" : totals.pages > 0 ? "partial" : "failed";
    const errorCode = error === null ? undefined : error instanceof AppError ? error.code : "INTERNAL";
    const errorMessage =
      error !== null
        ? error instanceof Error
          ? error.message
          : "Unknown error"
        : capped
          ? `page cap reached (${this.cfg.COLLECTOR_MAX_PAGES_PER_JOB})`
          : undefined;

    // BR-014: only a fully successful run moves the watermark; partial/failed rely on the overlap next time.
    // T-140: a backfill covers a fixed historical window and never moves the watermark.
    if (status === "success" && job.trigger !== "backfill")
      await this.prisma.listeningQuery.updateMany({
        where: { id: query.id, lockedBy: claimed.workerId },
        data: { lastSuccessfulSyncAt: until },
      });
    // FR-045/FR-085: 401 → `expired`, 403 → `permission_error`; the scheduler claim then skips the project.
    if (error !== null) {
      try {
        await this.health.recordProviderAuthFailure(query.projectId, errorCode, errorMessage ?? "");
      } catch (err: unknown) {
        this.logger.error({ err, jobId: job.id, projectId: query.projectId }, "integration status update failed");
      }
    }
    await this.recorder.finish(job.id, { status, errorCode, errorMessage });
    this.metrics.incSyncJob(status, job.trigger);

    this.logger.info(
      { jobId: job.id, queryId: query.id, windowReason: computed.reason, status, errorCode, ...totals },
      "collector run done",
    );
    return {
      status,
      completedAt: new Date(),
      ...(errorCode ? { errorCode } : {}),
      ...(errorMessage ? { errorMessage } : {}),
    };
  }
}

/** Maps a provider failure to the `outcome` label of collector_provider_requests_total (doc 09 §2). */
function providerOutcome(err: unknown): ProviderOutcome {
  const code = err instanceof AppError ? err.code : (err as { code?: unknown } | null)?.code;
  if (code === "THREADS_RATE_LIMITED") return "rate_limited";
  if (code === "THREADS_TIMEOUT") return "timeout";
  return "error";
}

/** Only parsed numbers/strings from the provider headers are kept — never the token (doc 06 §9). */
function toProviderUsage(page: SearchPage): ProviderUsage | null {
  const rl = page.rateLimit;
  if (!rl) return null;
  const raw = Object.fromEntries(Object.entries(rl.raw ?? {}).filter(([k]) => !/authorization|token|cookie/i.test(k)));
  return {
    remaining: rl.remaining ?? null,
    resetAt: rl.resetAt?.toISOString() ?? null,
    raw,
    observedAt: new Date().toISOString(),
  };
}
