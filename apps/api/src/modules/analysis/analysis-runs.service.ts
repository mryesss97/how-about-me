import { Inject, Injectable } from "@nestjs/common";
import type {
  AnalysisRunsListQuery,
  MarkStaleQuery,
  MarkStaleResponse,
  RetryFailedBody,
} from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/app.error";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { type AnalysisRunsPage, AnalysisRunsRepository } from "./analysis-runs.repository";
import { AnalysisService } from "./analysis.service";
import { BULK_REANALYZE_AUDIT_ACTION, BulkReanalyzeThrottle } from "./bulk-reanalyze-throttle";

/** Interactive tx timeout for bulk operations (Prisma default 5 s is too short for ANALYSIS_BULK_MAX posts). */
export const BULK_TX_TIMEOUT_MS = 30_000;

export const ANALYSIS_RETRY_AUDIT_ACTION = "analysis.retry_requested";

/** Unique violation from raw SQL (P2010 → PG 23505) or the Prisma client (P2002): the BR-024 open-run index. */
function isUniqueViolation(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2002") return true;
  const meta: unknown = e.meta;
  return e.code === "P2010" && typeof meta === "object" && meta !== null && "code" in meta && meta.code === "23505";
}

/** Ops use cases on analysis_runs — docs/02-architecture/05-api-contract.md §9, doc 07 §7 (T-145). */
@Injectable()
export class AnalysisRunsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly analysis: AnalysisService,
    private readonly throttle: BulkReanalyzeThrottle,
    private readonly audit: AuditService,
    private readonly repo: AnalysisRunsRepository,
  ) {}

  /** FR-175 ops list, `createdAt desc, id desc`. */
  list(projectId: string, query: AnalysisRunsListQuery): Promise<AnalysisRunsPage> {
    return this.repo.list(projectId, query);
  }

  /**
   * FR-175: admin retry of one failed run, in place (same id; doc 07 §1 `failed → pending`).
   * 404 outside the project, 409 ANALYSIS_RUN_NOT_RETRYABLE unless failed, 409 ANALYSIS_ALREADY_PENDING when the
   * post already has an open run (BR-024). Audited in the same tx.
   */
  async retry(
    projectId: string,
    runId: string,
    actorUserId: string,
    requestId: string | null,
  ): Promise<{ runId: string; status: "pending" }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await this.repo.lockForRetryTx(tx, projectId, runId);
        if (!run) throw new AppError("NOT_FOUND", "Analysis run not found");
        if (run.status !== "failed")
          throw new AppError("ANALYSIS_RUN_NOT_RETRYABLE", `Analysis run with status ${run.status} cannot be retried`);
        if (run.hasOtherOpen) throw new AppError("ANALYSIS_ALREADY_PENDING", "Post already has an open analysis run");
        if (!(await this.repo.resetToPendingTx(tx, runId)))
          throw new AppError("ANALYSIS_RUN_NOT_RETRYABLE", "Analysis run is no longer failed");
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: ANALYSIS_RETRY_AUDIT_ACTION,
            entityType: "analysis_run",
            entityId: runId,
            metadata: { postIds: [run.postId] },
            requestId,
          },
          tx,
        );
        return { runId, status: "pending" as const };
      });
    } catch (e) {
      // BR-024: a concurrent enqueue won the partial unique index.
      if (isUniqueViolation(e)) throw new AppError("ANALYSIS_ALREADY_PENDING", "Post already has an open analysis run");
      throw e;
    }
  }

  /** FR-175: bulk retry of failed runs (≤ `limit`, one per post, BR-024). No throttle; one audit row, no ids (FR-200). */
  async retryFailed(
    projectId: string,
    body: RetryFailedBody,
    actorUserId: string,
    requestId: string | null,
  ): Promise<{ enqueued: number }> {
    return this.prisma.$transaction(
      async (tx) => {
        const enqueued = await this.repo.resetFailedTx(tx, projectId, body.limit);
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: ANALYSIS_RETRY_AUDIT_ACTION,
            entityType: "monitoring_project",
            entityId: projectId,
            metadata: { scope: "failed", counts: { enqueued, limit: body.limit } },
            requestId,
          },
          tx,
        );
        return { enqueued };
      },
      { timeout: BULK_TX_TIMEOUT_MS },
    );
  }

  /**
   * BR-023 / FR-100: pending|completed runs of `version` in the project → stale, then re-enqueue affected
   * posts (`trigger=version_change`) up to `ANALYSIS_BULK_MAX`, newest first. Posts whose effective relevance
   * is `irrelevant` are staled but not re-enqueued (BR-016). Shares the 1/5 min/project throttle with bulk
   * re-analyze (NFR-017); dryRun only counts and never consumes it.
   */
  async markStale(
    projectId: string,
    query: MarkStaleQuery,
    actorUserId: string,
    requestId: string | null,
  ): Promise<MarkStaleResponse> {
    const cap = this.cfg.ANALYSIS_BULK_MAX;
    if (query.dryRun) {
      await this.analysis.assertNotCurrentVersion(this.prisma, projectId, query.version);
      return { marked: await this.analysis.countVersionRuns(this.prisma, projectId, query.version), enqueued: 0, cap };
    }
    return this.prisma.$transaction(
      async (tx) => {
        await this.analysis.assertNotCurrentVersion(tx, projectId, query.version);
        await this.throttle.assertAllowed(tx, projectId);
        const { marked, postIds } = await this.analysis.markVersionStaleInProject(tx, projectId, query.version);
        const posts = await this.candidates(tx, projectId, postIds, cap);
        const res = await this.analysis.enqueueMany(tx, {
          projectId,
          posts,
          trigger: "version_change",
          requestedBy: actorUserId,
        });
        const enqueued = res.postIds.length;
        // FR-200: no post ids/text in audit metadata.
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: BULK_REANALYZE_AUDIT_ACTION,
            entityType: "monitoring_project",
            entityId: projectId,
            metadata: {
              scope: "version_change",
              filters: { version: query.version },
              counts: { marked, enqueued, cap },
              effectiveVersion: res.effectiveVersion,
            },
            requestId,
          },
          tx,
        );
        return { marked, enqueued, cap };
      },
      { timeout: BULK_TX_TIMEOUT_MS },
    );
  }

  private async candidates(
    tx: Prisma.TransactionClient,
    projectId: string,
    postIds: string[],
    cap: number,
  ): Promise<{ postId: string; contentHash: string; revision: number }[]> {
    if (postIds.length === 0 || cap === 0) return [];
    const rows = await tx.$queryRaw<{ id: string; content_hash: string; revision: number }[]>(Prisma.sql`
      SELECT p.id, p.content_hash, p.revision
      FROM social_posts p
      JOIN effective_post_analysis e ON e.post_id = p.id
      WHERE p.project_id = ${projectId}::uuid AND p.id = ANY(${postIds}::uuid[])
        AND e.relevance_label IS DISTINCT FROM 'irrelevant'
        AND NOT EXISTS (SELECT 1 FROM analysis_runs o WHERE o.post_id = p.id AND o.status IN ('pending', 'processing'))
      ORDER BY p.published_at DESC, p.id DESC
      LIMIT ${cap}`);
    return rows.map((r) => ({ postId: r.id, contentHash: r.content_hash, revision: r.revision }));
  }
}
