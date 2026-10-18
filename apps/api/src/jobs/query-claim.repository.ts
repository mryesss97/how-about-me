import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { ClaimedQuery } from "./collector-runner";

type ClaimRow = {
  id: string;
  project_id: string;
  poll_interval_seconds: number;
  consecutive_failures: number;
  next_run_at: Date | null;
  manual_job_id: string | null;
};

export type CompleteRunInput = {
  nextRunAt: Date;
  consecutiveFailures: number;
  lastRunAt: Date;
  /** Present only for failed runs; written to last_error_* columns. */
  error?: { code: string; message: string; at: Date };
};

/**
 * DB claiming for listening queries — FR-086, docs/02-architecture/02-backend-design.md §6.
 * Single-statement UPDATE … FOR UPDATE SKIP LOCKED: safe across instances without an explicit transaction.
 */
@Injectable()
export class QueryClaimRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claims up to `limit` due queries. Due = next_run_at <= now() OR NULL (new query) OR a queued manual job.
   * Skips disabled/soft-deleted (BR-010), projects with an open circuit or without a connected Threads
   * integration (ingestion §3), and queries locked less than `staleMinutes` ago (TC-COL-023).
   * Manual jobs first (FR-058, TC-COL-027), then oldest next_run_at.
   */
  async claimDueQueries(workerId: string, limit: number, staleMinutes: number): Promise<ClaimedQuery[]> {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>(Prisma.sql`
      UPDATE listening_queries q
         SET locked_at = now(), locked_by = ${workerId}
        FROM (
          SELECT lq.id, mj.id AS manual_job_id
            FROM listening_queries lq
            LEFT JOIN LATERAL (
              SELECT sj.id FROM sync_jobs sj
               WHERE sj.query_id = lq.id AND sj.status = 'queued' AND sj.trigger = 'manual'
               ORDER BY sj.created_at
               LIMIT 1
            ) mj ON true
           WHERE lq.enabled AND lq.deleted_at IS NULL
             AND (lq.next_run_at IS NULL OR lq.next_run_at <= now() OR mj.id IS NOT NULL)
             AND (lq.locked_at IS NULL OR lq.locked_at < now() - make_interval(mins => ${staleMinutes}::int))
             AND NOT EXISTS (
               SELECT 1 FROM collector_state cs
                WHERE cs.project_id = lq.project_id AND cs.circuit_open_until > now())
             AND EXISTS (
               SELECT 1 FROM integration_connections ic
                WHERE ic.project_id = lq.project_id AND ic.platform = 'threads' AND ic.status = 'connected')
           ORDER BY (mj.id IS NOT NULL) DESC, lq.next_run_at ASC NULLS FIRST
           LIMIT ${limit}
           FOR UPDATE OF lq SKIP LOCKED
        ) c
       WHERE q.id = c.id
      RETURNING q.id, q.project_id, q.poll_interval_seconds, q.consecutive_failures, q.next_run_at, c.manual_job_id
    `);
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      pollIntervalSeconds: r.poll_interval_seconds,
      consecutiveFailures: r.consecutive_failures,
      nextRunAt: r.next_run_at,
      manualJobId: r.manual_job_id,
      workerId,
    }));
  }

  /**
   * Writes schedule state and releases the lock. Guarded by `locked_by` so a worker whose stale lock was
   * re-claimed by another worker cannot overwrite it. Returns affected rows (0 = lock lost).
   */
  async completeRun(queryId: string, workerId: string, input: CompleteRunInput): Promise<number> {
    const errorSet = input.error
      ? Prisma.sql`, last_error_at = ${input.error.at}, last_error_code = ${input.error.code}, last_error_message = ${input.error.message}`
      : Prisma.empty;
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE listening_queries
         SET locked_at = NULL, locked_by = NULL,
             next_run_at = ${input.nextRunAt}, consecutive_failures = ${input.consecutiveFailures},
             last_run_at = ${input.lastRunAt}, updated_at = now()
             ${errorSet}
       WHERE id = ${queryId}::uuid AND locked_by = ${workerId}
    `);
  }

  /** Releases one lock without touching the schedule (half-open probe denied, FR-084). */
  async releaseLock(queryId: string, workerId: string): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE listening_queries SET locked_at = NULL, locked_by = NULL
       WHERE id = ${queryId}::uuid AND locked_by = ${workerId}
    `);
  }

  /** Releases every lock held by this worker (graceful shutdown). */
  async releaseLocks(workerId: string): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE listening_queries SET locked_at = NULL, locked_by = NULL WHERE locked_by = ${workerId}
    `);
  }
}
