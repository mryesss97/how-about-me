import { Injectable } from "@nestjs/common";
import { Prisma, type SearchMode, type SearchType, type SyncJob as SyncJobRow } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { SyncJob, SyncJobDetail, SyncJobsListQuery } from "@how-about-me/contracts";
import {
  countWhere,
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
  orderByIds,
  pageKeysByCreatedAt,
} from "../../common/pagination/created-at-keyset";
import { PrismaService } from "../../database/prisma.service";

export type SyncJobsPage = { items: SyncJob[]; nextCursor: string | null; totalCount?: number };

/** Query fields checked before a manual run is queued (T-043, BR-010). */
export type RunnableQuery = { id: string; enabled: boolean; deleted: boolean; searchMode: SearchMode };

/** Fields of a job needed to build its retry (FR-175). */
export type RetrySource = Pick<
  SyncJobRow,
  | "id"
  | "projectId"
  | "queryId"
  | "status"
  | "trigger"
  | "searchType"
  | "searchMode"
  | "windowSince"
  | "windowUntil"
  | "lastCursor"
>;

/** Read/list + retry insert for `sync_jobs` (T-055, FR-081, FR-175). Prisma types never leave this file. */
@Injectable()
export class SyncJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-081: keyset `(created_at, id) DESC` in SQL, then hydrate by id. */
  async list(projectId: string, q: SyncJobsListQuery): Promise<SyncJobsPage> {
    const cursor = decodeCreatedAtCursor(q.cursor);
    const where = buildSyncJobsWhereSql(projectId, q);
    const keys = await pageKeysByCreatedAt(this.prisma, "sync_jobs", where, cursor, q.limit);
    const pageKeys = keys.slice(0, q.limit);
    const ids = pageKeys.map((k) => k.id);
    const rows = ids.length === 0 ? [] : await this.prisma.syncJob.findMany({ where: { id: { in: ids } } });
    const last = pageKeys.at(-1);
    const nextCursor = keys.length > q.limit && last ? encodeCreatedAtCursor(last) : null;
    const page: SyncJobsPage = { items: orderByIds(ids, rows).map(toSyncJob), nextCursor };
    if (q.count) page.totalCount = await countWhere(this.prisma, "sync_jobs", where);
    return page;
  }

  async findById(projectId: string, id: string): Promise<SyncJobDetail | null> {
    const row = await this.prisma.syncJob.findFirst({ where: { id, projectId } });
    return row ? toSyncJobDetail(row) : null;
  }

  async findRetrySourceTx(tx: Prisma.TransactionClient, projectId: string, id: string): Promise<RetrySource | null> {
    return tx.syncJob.findFirst({
      where: { id, projectId },
      select: {
        id: true,
        projectId: true,
        queryId: true,
        status: true,
        trigger: true,
        searchType: true,
        searchMode: true,
        windowSince: true,
        windowUntil: true,
        lastCursor: true,
      },
    });
  }

  /** Locks the query row (race guard for concurrent retries) and returns whether it may run (BR-010). */
  async lockQueryRunnableTx(tx: Prisma.TransactionClient, queryId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ runnable: boolean }[]>(
      Prisma.sql`SELECT (enabled AND deleted_at IS NULL) AS runnable FROM listening_queries
        WHERE id = ${queryId}::uuid FOR UPDATE`,
    );
    return rows[0]?.runnable === true;
  }

  /** T-043: locks the project's query row (FOR UPDATE, race guard) and returns its run state; null = not found. */
  async findRunnableQueryTx(
    tx: Prisma.TransactionClient,
    projectId: string,
    queryId: string,
  ): Promise<RunnableQuery | null> {
    const rows = await tx.$queryRaw<{ id: string; enabled: boolean; deleted: boolean; search_mode: SearchMode }[]>(
      Prisma.sql`SELECT id::text AS id, enabled, (deleted_at IS NOT NULL) AS deleted, search_mode::text AS search_mode
        FROM listening_queries WHERE id = ${queryId}::uuid AND project_id = ${projectId}::uuid FOR UPDATE`,
    );
    const r = rows[0];
    return r ? { id: r.id, enabled: r.enabled, deleted: r.deleted, searchMode: r.search_mode } : null;
  }

  /** T-043 / FR-058: new queued `manual` job; window/cursor left null so the recorder computes them on take-over. */
  async createManualTx(
    tx: Prisma.TransactionClient,
    q: { projectId: string; queryId: string; searchMode: SearchMode },
    requestedBy: string,
  ): Promise<string> {
    const id = uuidv7();
    await tx.syncJob.create({
      data: {
        id,
        projectId: q.projectId,
        queryId: q.queryId,
        status: "queued",
        trigger: "manual",
        searchType: "RECENT",
        searchMode: q.searchMode,
        requestedBy,
      },
    });
    return id;
  }

  /** T-140 / FR-063: new queued `backfill` job with a fixed window + search type (BR-008); cursor starts empty. */
  async createBackfillTx(
    tx: Prisma.TransactionClient,
    b: {
      projectId: string;
      queryId: string;
      searchMode: SearchMode;
      searchType: SearchType;
      windowSince: Date;
      windowUntil: Date;
    },
    requestedBy: string,
  ): Promise<string> {
    const id = uuidv7();
    await tx.syncJob.create({
      data: {
        id,
        projectId: b.projectId,
        queryId: b.queryId,
        status: "queued",
        trigger: "backfill",
        searchType: b.searchType,
        searchMode: b.searchMode,
        windowSince: b.windowSince,
        windowUntil: b.windowUntil,
        lastCursor: null,
        requestedBy,
      },
    });
    return id;
  }

  async findActiveForQueryTx(tx: Prisma.TransactionClient, queryId: string): Promise<string | null> {
    const job = await tx.syncJob.findFirst({
      where: { queryId, status: { in: ["queued", "running"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return job?.id ?? null;
  }

  /** New queued `retry` job resuming from the source's `last_cursor` + window (doc 06 §5, TC-SYS-011). */
  async createRetryTx(tx: Prisma.TransactionClient, src: RetrySource, requestedBy: string): Promise<string> {
    const id = uuidv7();
    await tx.syncJob.create({
      data: {
        id,
        projectId: src.projectId,
        queryId: src.queryId,
        status: "queued",
        // T-140 / BR-014: a retried backfill stays `backfill` so it still never moves the watermark.
        trigger: src.trigger === "backfill" ? "backfill" : "retry",
        searchType: src.searchType,
        searchMode: src.searchMode,
        windowSince: src.windowSince,
        windowUntil: src.windowUntil,
        lastCursor: src.lastCursor,
        requestedBy,
      },
    });
    return id;
  }
}

/** Project scope always; status/trigger any-of; from inclusive, to exclusive on created_at (UTC instants). */
export function buildSyncJobsWhereSql(projectId: string, q: SyncJobsListQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`project_id = ${projectId}::uuid`];
  if (q.queryId) parts.push(Prisma.sql`query_id = ${q.queryId}::uuid`);
  if (q.status.length > 0) parts.push(Prisma.sql`status::text = ANY(${q.status}::text[])`);
  if (q.trigger.length > 0) parts.push(Prisma.sql`trigger::text = ANY(${q.trigger}::text[])`);
  if (q.from) parts.push(Prisma.sql`created_at >= ${q.from}::timestamptz`);
  if (q.to) parts.push(Prisma.sql`created_at < ${q.to}::timestamptz`);
  return Prisma.join(parts, " AND ");
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toSyncJob(r: SyncJobRow): SyncJob {
  return {
    id: r.id,
    queryId: r.queryId,
    status: r.status,
    trigger: r.trigger,
    searchType: r.searchType,
    searchMode: r.searchMode,
    windowSince: iso(r.windowSince),
    windowUntil: iso(r.windowUntil),
    startedAt: iso(r.startedAt),
    completedAt: iso(r.completedAt),
    pagesFetched: r.pagesFetched,
    recordsFetched: r.recordsFetched,
    recordsInserted: r.recordsInserted,
    recordsUpdated: r.recordsUpdated,
    recordsDuplicated: r.recordsDuplicated,
    recordsInvalid: r.recordsInvalid,
    recordsExcluded: r.recordsExcluded,
    providerRequests: r.providerRequests,
    rateLimitEvents: r.rateLimitEvents,
    lastCursor: r.lastCursor,
    error: r.errorCode ? { code: r.errorCode, message: r.errorMessage ?? "" } : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toSyncJobDetail(r: SyncJobRow): SyncJobDetail {
  return { ...toSyncJob(r), providerUsage: toProviderUsage(r.providerUsage) };
}

/** Drops `raw` provider headers; tolerates malformed JSON by returning null. */
function toProviderUsage(v: Prisma.JsonValue): SyncJobDetail["providerUsage"] {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const { remaining, resetAt, observedAt } = v;
  if (typeof observedAt !== "string") return null;
  return {
    remaining: typeof remaining === "number" ? remaining : null,
    resetAt: typeof resetAt === "string" ? resetAt : null,
    observedAt,
  };
}
