import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { type AnalyticsScope, withBase } from "./analytics-filters";
import type { QueryShareRow } from "./query-share";

/**
 * §4 Keyword share (FR-145, FR-147) — a post counts once per matched query (overlap); excluded_by_terms=true
 * matches never count (A18); soft-deleted queries are listed only with counts (BR-010).
 */
@Injectable()
export class AnalyticsQueryShareRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProjectTimezone(projectId: string): Promise<{ id: string; timezone: string } | null> {
    return this.prisma.monitoringProject.findUnique({ where: { id: projectId }, select: { id: true, timezone: true } });
  }

  /** Per-query DISTINCT counts + denominator |B| in one transaction (two statements, consistent enough for P1). */
  async queryShareCounts(scope: AnalyticsScope): Promise<{ rows: QueryShareRow[]; denominator: number }> {
    const ids = scope.filters.queryIds;
    const hasIds = ids.length > 0;
    const matchFilter = hasIds ? Prisma.sql`AND m.query_id = ANY(${ids}::uuid[])` : Prisma.empty;
    const listFilter = hasIds
      ? Prisma.sql`AND q.id = ANY(${ids}::uuid[])`
      : Prisma.sql`AND (q.deleted_at IS NULL OR p.n > 0)`;
    const [rows, denom] = await this.prisma.$transaction([
      this.prisma.$queryRaw<QueryShareRow[]>(
        withBase(
          scope,
          Prisma.sql`, per_query AS (
              SELECT m.query_id, COUNT(DISTINCT b.post_id)::int AS n
                FROM base b
                JOIN post_query_matches m ON m.post_id = b.post_id AND m.excluded_by_terms = false ${matchFilter}
               GROUP BY 1)
            SELECT q.id::text AS "queryId", q.display_name AS "displayName", COALESCE(p.n, 0)::int AS count
              FROM listening_queries q LEFT JOIN per_query p ON p.query_id = q.id
             WHERE q.project_id = ${scope.projectId}::uuid ${listFilter}
             ORDER BY count DESC, q.display_name ASC, q.id ASC`,
        ),
      ),
      this.prisma.$queryRaw<{ n: number }[]>(
        withBase(scope, Prisma.sql`SELECT COUNT(DISTINCT post_id)::int AS n FROM base`),
      ),
    ]);
    return { rows, denominator: denom[0]?.n ?? 0 };
  }
}
