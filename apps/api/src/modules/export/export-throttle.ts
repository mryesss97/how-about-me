import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/app.error";

/** NFR-017 / doc 08 §7: at most 5 CSV exports per minute per user (across all projects). */
export const EXPORT_THROTTLE_LIMIT = 5;
export const EXPORT_THROTTLE_WINDOW_SECONDS = 60;
export const EXPORT_AUDIT_ACTION = "mentions.exported";

export function clampRetryAfter(wait: number): number {
  return Math.max(1, Math.min(EXPORT_THROTTLE_WINDOW_SECONDS, Math.ceil(wait)));
}

/**
 * DB-backed throttle (same approach as T-145): successful export audit rows are the tokens, so 413/429 never
 * consume quota and the limit holds across instances. A per-user advisory xact lock serializes concurrent requests.
 * Uses DB `now()` to avoid clock skew.
 */
@Injectable()
export class ExportThrottle {
  async assertAllowed(tx: Prisma.TransactionClient, actorUserId: string): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`mentions.export:${actorUserId}`}, 0))::text`,
    );
    const rows = await tx.$queryRaw<{ n: number; wait: number | null }[]>(Prisma.sql`
      WITH recent AS (
        SELECT created_at FROM audit_logs
         WHERE actor_user_id = ${actorUserId}::uuid AND action = ${EXPORT_AUDIT_ACTION}
           AND created_at > now() - make_interval(secs => ${EXPORT_THROTTLE_WINDOW_SECONDS})
         ORDER BY created_at DESC LIMIT ${EXPORT_THROTTLE_LIMIT})
      SELECT count(*)::int AS n,
             ceil(${EXPORT_THROTTLE_WINDOW_SECONDS} - extract(epoch FROM (now() - min(created_at))))::int AS wait
        FROM recent`);
    const r = rows[0];
    if (r && r.n >= EXPORT_THROTTLE_LIMIT) {
      throw new AppError("RATE_LIMITED", `Export is limited to ${EXPORT_THROTTLE_LIMIT} per minute`, {
        retryAfterSeconds: clampRetryAfter(r.wait ?? EXPORT_THROTTLE_WINDOW_SECONDS),
      });
    }
  }
}
