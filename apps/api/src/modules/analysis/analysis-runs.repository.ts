import { Injectable } from "@nestjs/common";
import { Prisma, type AnalysisRun as AnalysisRunRow } from "@prisma/client";
import type { AnalysisRun, AnalysisRunsListQuery } from "@how-about-me/contracts";
import {
  countWhere,
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
  orderByIds,
  pageKeysByCreatedAt,
} from "../../common/pagination/created-at-keyset";
import { PrismaService } from "../../database/prisma.service";

export type AnalysisRunsPage = { items: AnalysisRun[]; nextCursor: string | null; totalCount?: number };
export type RetryCandidate = { id: string; postId: string; status: string; hasOtherOpen: boolean };

/** Fields reset when a failed run goes back to pending (doc 07 §1 `failed → pending: admin retry`). */
const RESET_TO_PENDING_SQL = Prisma.sql`status = 'pending', attempt_count = 0, locked_at = NULL, locked_by = NULL,
  started_at = NULL, completed_at = NULL, error_code = NULL, error_message = NULL`;

/** Ops reads/updates on `analysis_runs` (T-077, FR-175). Prisma types never leave this file. */
@Injectable()
export class AnalysisRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Keyset `(created_at, id) DESC` in SQL, then hydrate by id. */
  async list(projectId: string, q: AnalysisRunsListQuery): Promise<AnalysisRunsPage> {
    const cursor = decodeCreatedAtCursor(q.cursor);
    const where = buildAnalysisRunsWhereSql(projectId, q);
    const keys = await pageKeysByCreatedAt(this.prisma, "analysis_runs", where, cursor, q.limit);
    const pageKeys = keys.slice(0, q.limit);
    const ids = pageKeys.map((k) => k.id);
    const rows =
      ids.length === 0
        ? []
        : await this.prisma.analysisRun.findMany({
            where: { id: { in: ids } },
            // #343: excerpt + author for the ops list; FK cascade guarantees the post exists.
            include: { post: { select: { text: true, username: true } } },
          });
    const last = pageKeys.at(-1);
    const nextCursor = keys.length > q.limit && last ? encodeCreatedAtCursor(last) : null;
    const page: AnalysisRunsPage = { items: orderByIds(ids, rows).map(toAnalysisRun), nextCursor };
    if (q.count) page.totalCount = await countWhere(this.prisma, "analysis_runs", where);
    return page;
  }

  /** Locks the run (FOR UPDATE) and reports whether its post has another open run (BR-024). */
  async lockForRetryTx(tx: Prisma.TransactionClient, projectId: string, id: string): Promise<RetryCandidate | null> {
    const rows = await tx.$queryRaw<{ id: string; post_id: string; status: string; has_other_open: boolean }[]>(
      Prisma.sql`SELECT r.id::text AS id, r.post_id::text AS post_id, r.status::text AS status,
          EXISTS (SELECT 1 FROM analysis_runs o WHERE o.post_id = r.post_id AND o.id <> r.id
                  AND o.status IN ('pending', 'processing')) AS has_other_open
        FROM analysis_runs r WHERE r.id = ${id}::uuid AND r.project_id = ${projectId}::uuid FOR UPDATE`,
    );
    const r = rows[0];
    return r ? { id: r.id, postId: r.post_id, status: r.status, hasOtherOpen: r.has_other_open } : null;
  }

  /** Guarded `failed → pending`; returns false if the run is no longer failed. */
  async resetToPendingTx(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
    const n = await tx.$executeRaw(
      Prisma.sql`UPDATE analysis_runs SET ${RESET_TO_PENDING_SQL} WHERE id = ${id}::uuid AND status = 'failed'`,
    );
    return n === 1;
  }

  /**
   * Bulk `failed → pending`, newest first, at most `limit`. Only the latest failed run per post and only posts
   * without an open run, so the BR-024 partial unique index is never violated.
   */
  async resetFailedTx(tx: Prisma.TransactionClient, projectId: string, limit: number): Promise<number> {
    return tx.$executeRaw(Prisma.sql`
      UPDATE analysis_runs SET ${RESET_TO_PENDING_SQL}
      WHERE id IN (
        SELECT c.id FROM (
          SELECT DISTINCT ON (r.post_id) r.id, r.created_at
          FROM analysis_runs r
          WHERE r.project_id = ${projectId}::uuid AND r.status = 'failed'
            AND NOT EXISTS (SELECT 1 FROM analysis_runs o WHERE o.post_id = r.post_id
                            AND o.status IN ('pending', 'processing'))
          ORDER BY r.post_id, r.created_at DESC, r.id DESC
        ) c
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${limit}
      ) AND status = 'failed'`);
  }
}

export function buildAnalysisRunsWhereSql(projectId: string, q: AnalysisRunsListQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`project_id = ${projectId}::uuid`];
  if (q.status.length > 0) parts.push(Prisma.sql`status::text = ANY(${q.status}::text[])`);
  if (q.from) parts.push(Prisma.sql`created_at >= ${q.from}::timestamptz`);
  if (q.to) parts.push(Prisma.sql`created_at < ${q.to}::timestamptz`);
  return Prisma.join(parts, " AND ");
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** #343: whitespace-collapsed text cut to `max` code points (never splits an emoji) + "…"; null when empty. */
export function toPostExcerpt(text: string | null, max = 80): string | null {
  if (text == null) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  const chars = Array.from(collapsed);
  return chars.length > max ? `${chars.slice(0, max).join("").trimEnd()}…` : collapsed;
}

type AnalysisRunWithPost = AnalysisRunRow & { post?: { text: string | null; username: string | null } | null };

export function toAnalysisRun(r: AnalysisRunWithPost): AnalysisRun {
  return {
    id: r.id,
    postId: r.postId,
    status: r.status,
    trigger: r.trigger,
    effectiveVersion: r.effectiveVersion,
    attemptCount: r.attemptCount,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    startedAt: iso(r.startedAt),
    completedAt: iso(r.completedAt),
    createdAt: r.createdAt.toISOString(),
    post: { excerpt: toPostExcerpt(r.post?.text ?? null), username: r.post?.username ?? null },
  };
}
