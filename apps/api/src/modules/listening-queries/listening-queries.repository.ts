import { Injectable } from "@nestjs/common";
import { Prisma, type QueryType } from "@prisma/client";
import type { ListeningQuery, ListeningQueryListQuery } from "@how-about-me/contracts";
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
    const creators = await this.loadCreators(page.map((r) => r.createdBy));
    const result: ListeningQueryPage = { items: page.map((r) => toListeningQuery(r, creators)), nextCursor };
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

  async toDto(row: ListeningQueryRow): Promise<ListeningQuery> {
    return toListeningQuery(row, await this.loadCreators([row.createdBy]));
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

export function toListeningQuery(r: ListeningQueryRow, creators: Map<string, CreatorRef>): ListeningQuery {
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
    // Placeholders until T-045 (#41) fills job/match summaries.
    lastJob: null,
    matchedPosts: { total: 0, last24h: 0 },
    createdBy: creator ? { id: creator.id, displayName: creator.displayName } : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: iso(r.deletedAt),
  };
}
