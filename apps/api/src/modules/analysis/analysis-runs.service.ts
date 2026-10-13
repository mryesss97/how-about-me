import { Inject, Injectable } from "@nestjs/common";
import type { MarkStaleQuery, MarkStaleResponse } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AnalysisService } from "./analysis.service";
import { BULK_REANALYZE_AUDIT_ACTION, BulkReanalyzeThrottle } from "./bulk-reanalyze-throttle";

/** Interactive tx timeout for bulk operations (Prisma default 5 s is too short for ANALYSIS_BULK_MAX posts). */
export const BULK_TX_TIMEOUT_MS = 30_000;

/** Ops use cases on analysis_runs — docs/02-architecture/05-api-contract.md §9, doc 07 §7 (T-145). */
@Injectable()
export class AnalysisRunsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly analysis: AnalysisService,
    private readonly throttle: BulkReanalyzeThrottle,
    private readonly audit: AuditService,
  ) {}

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
