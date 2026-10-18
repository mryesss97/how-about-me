import { Inject, Injectable, type BeforeApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
import { randomUUID } from "node:crypto";
import { PinoLogger } from "nestjs-pino";
import { AppError } from "../common/errors/app.error";
import { APP_CONFIG, type AppConfig } from "../config/config.module";
import { AuditService } from "../modules/audit/audit.service";
import { IntegrationHealthService } from "../modules/integrations/integration-health.service";
import { IntegrationsRepository } from "../modules/integrations/integrations.repository";
import {
  SOCIAL_DISCOVERY_PROVIDER,
  type SocialDiscoveryProvider,
} from "../modules/integrations/threads/social-discovery.provider";
import { ThreadsTokenStore } from "../modules/integrations/threads/threads-token.store";

export const TOKEN_REFRESH_CRON_JOB = "threads-token-refresh-job";
const DAY_MS = 86_400_000;
const SHUTDOWN_WAIT_MS = 30_000;

export type TokenRefreshSummary = { candidates: number; refreshed: number; failed: number };

/**
 * Daily Threads token refresh (T-040, FR-046 P0*) — docs/02-architecture/06-ingestion-pipeline.md §7.
 * Registered only when THREADS_TOKEN_REFRESH_MODE=on, APP_ROLE ∈ {worker, all}, NODE_ENV ≠ test and the
 * provider implements `refreshToken` (otherwise FR-046 is N/A and only a warning is logged).
 * Refreshes `connected` connections whose token expires within WINDOW_DAYS; a failure writes the
 * `integration.refresh_failed` audit (actor null) and, on 401/403, moves the status like the collector.
 */
@Injectable()
export class TokenRefreshJobService implements OnModuleInit, BeforeApplicationShutdown {
  private current: Promise<TokenRefreshSummary> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(SOCIAL_DISCOVERY_PROVIDER) private readonly provider: SocialDiscoveryProvider,
    private readonly repo: IntegrationsRepository,
    private readonly tokens: ThreadsTokenStore,
    private readonly health: IntegrationHealthService,
    private readonly audit: AuditService,
    private readonly registry: SchedulerRegistry,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TokenRefreshJobService.name);
  }

  onModuleInit() {
    const {
      THREADS_TOKEN_REFRESH_MODE: mode,
      THREADS_TOKEN_REFRESH_CRON: cron,
      THREADS_TOKEN_REFRESH_TIMEZONE: tz,
    } = this.cfg;
    if (mode !== "on") return;
    if (this.cfg.APP_ROLE !== "worker" && this.cfg.APP_ROLE !== "all") return;
    if (this.cfg.NODE_ENV === "test") return;
    if (typeof this.provider.refreshToken !== "function") {
      this.logger.warn("threads token refresh unsupported by provider (FR-046 N/A); job not scheduled");
      return;
    }
    const job = CronJob.from({ cronTime: cron, onTick: () => void this.run(), start: false, timeZone: tz });
    this.registry.addCronJob(TOKEN_REFRESH_CRON_JOB, job);
    job.start();
    this.logger.info({ cron, tz }, "threads token refresh job scheduled");
  }

  /** One run; an overlapping call in the same instance returns the in-flight run. */
  run(now: Date = new Date()): Promise<TokenRefreshSummary> {
    if (this.current) return this.current;
    this.current = this.doRun(now).finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async doRun(now: Date): Promise<TokenRefreshSummary> {
    const summary: TokenRefreshSummary = { candidates: 0, refreshed: 0, failed: 0 };
    const refresh = this.provider.refreshToken?.bind(this.provider);
    if (!refresh) return summary;
    const requestId = randomUUID();
    const before = new Date(now.getTime() + this.cfg.THREADS_TOKEN_REFRESH_WINDOW_DAYS * DAY_MS);
    const rows = await this.repo.findExpiringThreads(before);
    summary.candidates = rows.length;
    // Sequential; one connection's failure never blocks the next.
    for (const row of rows) {
      try {
        const accessToken = await this.tokens.read(row.projectId);
        if (!accessToken) throw new AppError("NOT_FOUND", "No stored token");
        const next = await refresh({ accessToken, requestId, projectId: row.projectId });
        await this.repo.transaction(async (tx) => {
          await this.tokens.save(row.id, next.accessToken, tx);
          await this.repo.update(row.id, { tokenExpiresAt: next.tokenExpiresAt }, tx);
        });
        summary.refreshed++;
      } catch (err: unknown) {
        summary.failed++;
        await this.onFailure(row, err, requestId);
      }
    }
    this.logger.info({ requestId, ...summary }, "threads token refresh done");
    return summary;
  }

  private async onFailure(row: { id: string; projectId: string }, err: unknown, requestId: string) {
    const errorCode = err instanceof AppError ? err.code : "INTERNAL";
    const message = err instanceof Error ? err.message : "Unknown error";
    // Never log/audit the token; metadata keys avoid the `token` deny pattern (doc 08 §6).
    this.logger.warn({ requestId, connectionId: row.id, projectId: row.projectId, errorCode }, "token refresh failed");
    await this.audit.record({
      projectId: row.projectId,
      actorUserId: null,
      action: "integration.refresh_failed",
      entityType: "integration_connection",
      entityId: row.id,
      metadata: { errorCode, status: "failed" },
      requestId,
    });
    try {
      await this.health.recordProviderAuthFailure(row.projectId, errorCode, message);
    } catch (e: unknown) {
      this.logger.error({ err: e, requestId, connectionId: row.id }, "integration status update failed");
    }
  }

  async beforeApplicationShutdown() {
    if (this.registry.doesExist("cron", TOKEN_REFRESH_CRON_JOB)) {
      void this.registry.getCronJob(TOKEN_REFRESH_CRON_JOB).stop();
      this.registry.deleteCronJob(TOKEN_REFRESH_CRON_JOB);
    }
    if (this.current) {
      await Promise.race([this.current, new Promise<void>((r) => setTimeout(r, SHUTDOWN_WAIT_MS).unref())]);
    }
  }
}
