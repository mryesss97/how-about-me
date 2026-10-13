import { Injectable } from "@nestjs/common";
import { Prisma, type QueryType } from "@prisma/client";
import { z } from "zod";
import type { ListeningQuery, ListeningQueryListQuery } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor";
import { PrismaService } from "../../database/prisma.service";

export type ListeningQueryRow = Prisma.ListeningQueryGetPayload<object>;
export type CreatorRef = { id: string; displayName: string | null };
export type ListeningQueryPage = { items: ListeningQuery[]; nextCursor: string | null; totalCount?: number };

const IdRowsSchema = z.array(z.object({ id: z.string() }));

/** Prisma access for listening_queries (docs/02-architecture/04-data-model.md §4.6). Maps rows to contract DTOs. */
@Injectable()
export class ListeningQueriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * BR-006 / FR-053: same expression as the partial unique index `listening_queries_active_unique`
   * (lower(query_value), active rows only). Exact `lower() = lower()` — no ILIKE, so `_`/`%` are literal.
   */
  async findActiveDuplicate(
    projectId: string,
    queryType: QueryType,
    queryValue: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const db = tx ?? this.prisma;
    const exclude = excludeId ? Prisma.sql`AND id <> ${excludeId}::uuid` : Prisma.empty;
    const rows: unknown = await db.$queryRaw(Prisma.sql`
      SELECT id::text AS id FROM listening_queries
       WHERE project_id = ${projectId}::uuid
         AND platform = 'threads'
         AND query_type = ${queryType}::query_type
         AND lower(query_value) = lower(${queryValue})
         AND deleted_at IS NULL
         ${exclude}
       LIMIT 1`);
    return IdRowsSchema.parse(rows)[0]?.id ?? null;
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

  async list(projectId: string, q: ListeningQueryListQuery): Promise<ListeningQueryPage> {
    const where: Prisma.ListeningQueryWhereInput = {
      projectId,
      ...(q.includeDeleted ? {} : { deletedAt: null }),
      ...(q.enabled === undefined ? {} : { enabled: q.enabled }),
      ...(q.type ? { queryType: q.type } : {}),
    };
    const cursor = decodeCursor(q.cursor);
    const keyset: Prisma.ListeningQueryWhereInput = cursor ? cursorWhere(cursor) : {};
    const rows = await this.prisma.listeningQuery.findMany({
      where: { AND: [where, keyset] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > q.limit && last ? encodeCursor({ key: last.createdAt.toISOString(), id: last.id }) : null;
    const creators = await this.loadCreators(page.map((r) => r.createdBy));
    const result: ListeningQueryPage = { items: page.map((r) => toListeningQuery(r, creators)), nextCursor };
    if (q.count) result.totalCount = await this.prisma.listeningQuery.count({ where });
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

/** Keyset on (createdAt desc, id desc). */
export function cursorWhere(c: { key: string; id: string }): Prisma.ListeningQueryWhereInput {
  const at = new Date(c.key);
  if (Number.isNaN(at.getTime())) throw new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: c.id } }] };
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
