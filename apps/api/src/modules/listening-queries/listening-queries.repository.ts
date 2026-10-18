import { Injectable } from "@nestjs/common";
import { Prisma, type QueryType } from "@prisma/client";
import { JobStatusSchema, type ListeningQuery, type ListeningQueryListQuery } from "@how-about-me/contracts";
import { findActiveQueryDuplicate } from "../../common/queries/find-active-query-duplicate";
import {
  countWhere,
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
  orderByIds,
  pageKeysByCreatedAt,
} from "../../common/pagination/created-at-keyset";
import { PrismaService } from "../../database/prisma.service";

export type ListeningQueryRow = Prisma.ListeningQueryGetPayload<object>;
export type CreatorRef = { id: string; displayName: string | null };
export type QuerySyncSummary = { lastJob: ListeningQuery["lastJob"]; matchedPosts: ListeningQuery["matchedPosts"] };
type SyncSummaryRow = {
  id: string;
  job_id: string | null;
  status: string | null;
  records_fetched: number | null;
  records_inserted: number | null;
  completed_at: Date | null;
  total: number;
  last24h: number;
};
const DAY_MS = 24 * 60 * 60 * 1000;
export type ListeningQueryPage = { items: ListeningQuery[]; nextCursor: string | null; totalCount?: number };

/** Prisma access for listening_queries (docs/02-architecture/04-data-model.md §4.6). Maps rows to contract DTOs. */
@Injectable()
export class ListeningQueriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * BR-006 / FR-053: same expression as the partial unique index `listening_queries_active_unique`
   * (lower(query_value), active rows only). Exact `lower() = lower()` — no ILIKE, so `_`/`%` are literal.
   * Delegates to common/queries/find-active-query-duplicate.ts (shared with prisma/seed.ts).
   */
  async findActiveDuplicate(
    projectId: string,
    queryType: QueryType,
    queryValue: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    return findActiveQueryDuplicate(tx ?? this.prisma, { projectId, queryType, queryValue, excludeId });
  }

  create(data: Prisma.ListeningQueryUncheckedCreateInput, tx?: Prisma.TransactionClient): Promise<ListeningQueryRow> {
    return (tx ?? this.prisma).listeningQuery.create({ data });
  }

  /** Project-scoped: a query of another project is reported as not found. Includes soft-deleted rows. */
  findById(projectId: string, id: string, tx?: Prisma.TransactionClient): Promise<ListeningQueryRow | null> {
    return (tx ?? this.prisma).listeningQuery.findFirst({ where: { id, projectId } });
  }

  update(
    id: string,
    data: Prisma.ListeningQueryUncheckedUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ListeningQueryRow> {
    return (tx ?? this.prisma).listeningQuery.update({ where: { id }, data });
  }

  /** FR-051 / #188: keyset `(created_at, id) DESC` in SQL (µs precision), then hydrate by id. */
  async list(projectId: string, q: ListeningQueryListQuery): Promise<ListeningQueryPage> {
    const cursor = decodeCreatedAtCursor(q.cursor);
    const where = buildListeningQueryWhereSql(projectId, q);
    const keys = await pageKeysByCreatedAt(this.prisma, "listening_queries", where, cursor, q.limit);
    const pageKeys = keys.slice(0, q.limit);
    const ids = pageKeys.map((k) => k.id);
    const rows = ids.length === 0 ? [] : await this.prisma.listeningQuery.findMany({ where: { id: { in: ids } } });
    const page = orderByIds(ids, rows);
    const last = pageKeys.at(-1);
    const nextCursor = keys.length > q.limit && last ? encodeCreatedAtCursor(last) : null;
    const [creators, summaries] = await Promise.all([
      this.loadCreators(page.map((r) => r.createdBy)),
      this.loadSyncSummaries(ids),
    ]);
    const result: ListeningQueryPage = {
      items: page.map((r) => toListeningQuery(r, creators, summaries)),
      nextCursor,
    };
    if (q.count) result.totalCount = await countWhere(this.prisma, "listening_queries", where);
    return result;
  }

  /** created_by has no FK/relation → batch lookup of user_profiles. */
  async loadCreators(ids: (string | null)[]): Promise<Map<string, CreatorRef>> {
    const unique = [...new Set(ids.filter((v): v is string => v !== null))];
    if (unique.length === 0) return new Map();
    const profiles = await this.prisma.userProfile.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true },
    });
    return new Map(profiles.map((p) => [p.id, p]));
  }

  /**
   * T-045 / FR-061: one batched statement (LATERAL joins, no N+1) for the page's ids.
   * lastJob = newest sync_job by (created_at, id) whatever its status; matchedPosts counts
   * post_query_matches rows (PK (post_id, query_id) ⇒ distinct posts), excluding excluded_by_terms,
   * last24h by first_matched_at >= now − 24h (rolling, UTC). Soft-deleted queries keep counts (BR-010).
   */
  async loadSyncSummaries(ids: string[], now: Date = new Date()): Promise<Map<string, QuerySyncSummary>> {
    if (ids.length === 0) return new Map();
    const since = new Date(now.getTime() - DAY_MS);
    const rows = await this.prisma.$queryRaw<SyncSummaryRow[]>(Prisma.sql`
      SELECT q.id::text AS id,
             j.id::text AS job_id, j.status::text AS status, j.records_fetched, j.records_inserted, j.completed_at,
             COALESCE(m.total, 0)::int AS total, COALESCE(m.last24h, 0)::int AS last24h
      FROM unnest(${ids}::uuid[]) AS q(id)
      LEFT JOIN LATERAL (
        SELECT id, status, records_fetched, records_inserted, completed_at
        FROM sync_jobs WHERE query_id = q.id
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) j ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE first_matched_at >= ${since})::int AS last24h
        FROM post_query_matches WHERE query_id = q.id AND NOT excluded_by_terms
      ) m ON true`);
    return new Map(rows.map((r) => [r.id, toSyncSummary(r)]));
  }

  async toDto(row: ListeningQueryRow): Promise<ListeningQuery> {
    const [creators, summaries] = await Promise.all([
      this.loadCreators([row.createdBy]),
      this.loadSyncSummaries([row.id]),
    ]);
    return toListeningQuery(row, creators, summaries);
  }
}

/** P2002 on listening_queries can only come from the active-unique index (PK is uuidv7). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Filters for list: project scope, soft-delete (unless includeDeleted), enabled, type. */
export function buildListeningQueryWhereSql(projectId: string, q: ListeningQueryListQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`project_id = ${projectId}::uuid`];
  if (!q.includeDeleted) parts.push(Prisma.sql`deleted_at IS NULL`);
  if (q.enabled !== undefined) parts.push(Prisma.sql`enabled = ${q.enabled}`);
  if (q.type) parts.push(Prisma.sql`query_type::text = ${q.type}`);
  return Prisma.join(parts, " AND ");
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toSyncSummary(r: SyncSummaryRow): QuerySyncSummary {
  const lastJob =
    r.job_id && r.status
      ? {
          id: r.job_id,
          status: JobStatusSchema.parse(r.status),
          recordsFetched: r.records_fetched ?? 0,
          recordsInserted: r.records_inserted ?? 0,
          completedAt: iso(r.completed_at),
        }
      : null;
  return { lastJob, matchedPosts: { total: r.total, last24h: r.last24h } };
}

const EMPTY_SUMMARY: QuerySyncSummary = { lastJob: null, matchedPosts: { total: 0, last24h: 0 } };

export function toListeningQuery(
  r: ListeningQueryRow,
  creators: Map<string, CreatorRef>,
  summaries: Map<string, QuerySyncSummary> = new Map(),
): ListeningQuery {
  const summary = summaries.get(r.id) ?? EMPTY_SUMMARY;
  const creator = r.createdBy ? creators.get(r.createdBy) : undefined;
  return {
    id: r.id,
    displayName: r.displayName,
    queryValue: r.queryValue,
    queryType: r.queryType,
    searchMode: r.searchMode,
    scheduledSearchType: r.scheduledSearchType,
    enabled: r.enabled,
    excludeTerms: r.excludeTerms,
    includeTerms: r.includeTerms,
    pollIntervalSeconds: r.pollIntervalSeconds,
    overlapSeconds: r.overlapSeconds,
    initialBackfillDays: r.initialBackfillDays,
    nextRunAt: iso(r.nextRunAt),
    lastRunAt: iso(r.lastRunAt),
    lastSuccessfulSyncAt: iso(r.lastSuccessfulSyncAt),
    lastError:
      r.lastErrorAt && r.lastErrorCode
        ? { code: r.lastErrorCode, message: r.lastErrorMessage ?? "", at: r.lastErrorAt.toISOString() }
        : null,
    // T-045 / FR-061: from loadSyncSummaries; empty when not loaded.
    lastJob: summary.lastJob,
    matchedPosts: { ...summary.matchedPosts },
    createdBy: creator ? { id: creator.id, displayName: creator.displayName } : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: iso(r.deletedAt),
  };
}
