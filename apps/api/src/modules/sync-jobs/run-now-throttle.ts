import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/app.error";

/** NFR-017 / TC-LQ-015: at most 10 run-now requests per minute per project. */
export const RUN_NOW_THROTTLE_LIMIT = 10;
export const RUN_NOW_THROTTLE_WINDOW_SECONDS = 60;
export const RUN_NOW_AUDIT_ACTION = "query.run_requested";

export function clampRunNowRetryAfter(wait: number): number {
  return Math.max(1, Math.min(RUN_NOW_THROTTLE_WINDOW_SECONDS, Math.ceil(wait)));
}

/**
 * DB-backed throttle (same approach as ExportThrottle): successful `query.run_requested` audit rows are the tokens,
 * so 404/409/429 never consume quota and the limit holds across instances. A per-project advisory xact lock
 * serializes concurrent requests. Uses DB `now()` (UTC). Audit MUST stay in the same transaction.
 */
@Injectable()
export class RunNowThrottle {
  async assertAllowed(tx: Prisma.TransactionClient, projectId: string): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`query.run:${projectId}`}, 0))::text`,
    );
    const rows = await tx.$queryRaw<{ n: number; wait: number | null }[]>(Prisma.sql`
      WITH recent AS (
        SELECT created_at FROM audit_logs
         WHERE project_id = ${projectId}::uuid AND action = ${RUN_NOW_AUDIT_ACTION}
           AND created_at > now() - make_interval(secs => ${RUN_NOW_THROTTLE_WINDOW_SECONDS})
         ORDER BY created_at DESC LIMIT ${RUN_NOW_THROTTLE_LIMIT})
      SELECT count(*)::int AS n,
             ceil(${RUN_NOW_THROTTLE_WINDOW_SECONDS} - extract(epoch FROM (now() - min(created_at))))::int AS wait
        FROM recent`);
    const r = rows[0];
    if (r && r.n >= RUN_NOW_THROTTLE_LIMIT) {
      throw new AppError("RATE_LIMITED", `Run now is limited to ${RUN_NOW_THROTTLE_LIMIT} per minute per project`, {
        retryAfterSeconds: clampRunNowRetryAfter(r.wait ?? RUN_NOW_THROTTLE_WINDOW_SECONDS),
      });
    }
  }
}
