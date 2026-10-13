import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/app.error";

/** NFR-017 / FR-196: bulk re-analysis (filters or mark-stale) at most once per 5 minutes per project. */
export const BULK_REANALYZE_WINDOW_SECONDS = 300;
export const BULK_REANALYZE_AUDIT_ACTION = "analysis.bulk_reanalyze_requested";

/**
 * DB-backed throttle (doc 08 §7): the audit row written in the same tx is the throttle token, so it holds
 * across instances and dry runs never consume it. Locks the project row to serialize concurrent admins.
 * Uses DB `now()` to avoid clock skew between instances.
 */
@Injectable()
export class BulkReanalyzeThrottle {
  async assertAllowed(tx: Prisma.TransactionClient, projectId: string): Promise<void> {
    const locked = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM monitoring_projects WHERE id = ${projectId}::uuid FOR UPDATE`,
    );
    if (locked.length === 0) throw AppError.notFound("Project");
    const rows = await tx.$queryRaw<{ wait: number | null }[]>(Prisma.sql`
      SELECT ceil(${BULK_REANALYZE_WINDOW_SECONDS} - extract(epoch FROM (now() - max(created_at))))::int AS wait
      FROM audit_logs
      WHERE project_id = ${projectId}::uuid AND action = ${BULK_REANALYZE_AUDIT_ACTION}
        AND created_at > now() - make_interval(secs => ${BULK_REANALYZE_WINDOW_SECONDS})`);
    const wait = rows[0]?.wait;
    if (wait != null) {
      throw new AppError("RATE_LIMITED", "Bulk re-analysis is limited to one request per 5 minutes per project", {
        retryAfterSeconds: Math.max(1, Math.min(BULK_REANALYZE_WINDOW_SECONDS, wait)),
      });
    }
  }
}
