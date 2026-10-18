import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export type CollectorStateRow = {
  consecutiveFailures: number;
  circuitOpenUntil: Date | null;
  circuitReason: string | null;
};

type RawRow = {
  consecutive_provider_failures: number;
  circuit_open_until: Date | null;
  circuit_reason: string | null;
};

const map = (r: RawRow): CollectorStateRow => ({
  consecutiveFailures: r.consecutive_provider_failures,
  circuitOpenUntil: r.circuit_open_until,
  circuitReason: r.circuit_reason,
});

/** `collector_state` persistence for the per-project circuit breaker — FR-084, ingestion §7. */
@Injectable()
export class CollectorStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async find(projectId: string): Promise<CollectorStateRow | null> {
    const rows = await this.prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT consecutive_provider_failures, circuit_open_until, circuit_reason
        FROM collector_state WHERE project_id = ${projectId}::uuid
    `);
    return rows[0] ? map(rows[0]) : null;
  }

  /** Resets the counter and closes the circuit. Returns the state before the reset (null = no row). */
  async reset(projectId: string): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ prev: number | null }[]>(Prisma.sql`
      WITH prev AS (SELECT consecutive_provider_failures AS f FROM collector_state WHERE project_id = ${projectId}::uuid)
      INSERT INTO collector_state (project_id, consecutive_provider_failures, circuit_open_until, circuit_reason, updated_at)
      VALUES (${projectId}::uuid, 0, NULL, NULL, now())
      ON CONFLICT (project_id) DO UPDATE
        SET consecutive_provider_failures = 0, circuit_open_until = NULL, circuit_reason = NULL, updated_at = now()
      RETURNING (SELECT f FROM prev) AS prev
    `);
    return rows[0]?.prev ?? null;
  }

  /** Atomic increment; opens (or re-opens) the circuit for `openSeconds` once the counter reaches `threshold`. */
  async recordFailure(
    projectId: string,
    threshold: number,
    openSeconds: number,
    reason: string,
  ): Promise<CollectorStateRow> {
    const rows = await this.prisma.$queryRaw<RawRow[]>(Prisma.sql`
      INSERT INTO collector_state AS cs (project_id, consecutive_provider_failures, circuit_open_until, circuit_reason, updated_at)
      VALUES (
        ${projectId}::uuid, 1,
        CASE WHEN 1 >= ${threshold}::int THEN now() + make_interval(secs => ${openSeconds}::int) END,
        CASE WHEN 1 >= ${threshold}::int THEN ${reason} END,
        now())
      ON CONFLICT (project_id) DO UPDATE SET
        consecutive_provider_failures = cs.consecutive_provider_failures + 1,
        circuit_open_until = CASE WHEN cs.consecutive_provider_failures + 1 >= ${threshold}::int
          THEN now() + make_interval(secs => ${openSeconds}::int) ELSE cs.circuit_open_until END,
        circuit_reason = CASE WHEN cs.consecutive_provider_failures + 1 >= ${threshold}::int
          THEN ${reason} ELSE cs.circuit_reason END,
        updated_at = now()
      RETURNING consecutive_provider_failures, circuit_open_until, circuit_reason
    `);
    const row = rows[0];
    if (!row) throw new Error("collector_state upsert returned no row");
    return map(row);
  }

  /**
   * Half-open probe acquisition in one statement: extends `circuit_open_until` so claiming blocks the other
   * queries of the project. Returns 'closed' (no breaker), 'acquired' (this caller is the probe) or 'denied'.
   */
  async tryAcquireProbe(
    projectId: string,
    threshold: number,
    openSeconds: number,
  ): Promise<"closed" | "acquired" | "denied"> {
    const rows = await this.prisma.$queryRaw<{ acquired: boolean; tripped: boolean | null }[]>(Prisma.sql`
      WITH upd AS (
        UPDATE collector_state
           SET circuit_open_until = now() + make_interval(secs => ${openSeconds}::int), updated_at = now()
         WHERE project_id = ${projectId}::uuid
           AND consecutive_provider_failures >= ${threshold}::int
           AND (circuit_open_until IS NULL OR circuit_open_until <= now())
        RETURNING project_id
      )
      SELECT EXISTS (SELECT 1 FROM upd) AS acquired,
             (SELECT consecutive_provider_failures >= ${threshold}::int FROM collector_state
               WHERE project_id = ${projectId}::uuid) AS tripped
    `);
    const r = rows[0];
    if (r?.acquired) return "acquired";
    return r?.tripped ? "denied" : "closed";
  }
}
