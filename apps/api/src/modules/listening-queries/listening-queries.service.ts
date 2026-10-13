import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import type {
  CreateListeningQueryBody,
  ListeningQuery,
  ListeningQueryListQuery,
  UpdateListeningQueryBody,
} from "@how-about-me/contracts";
import type { AuthUser } from "../../common/auth/current-user.decorator";
import { AppError } from "../../common/errors/app.error";
import { normalizeQuery } from "../../common/queries/normalize-query";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  isUniqueViolation,
  type ListeningQueryPage,
  type ListeningQueryRow,
  ListeningQueriesRepository,
} from "./listening-queries.repository";

type Ctx = { projectId: string; user: AuthUser; requestId: string | null };
type FieldChange = { before: unknown; after: unknown };

const ENTITY = "listening_query";

/** Listening query CRUD — FR-051…FR-057, BR-004…BR-010, audit BR-034 / FR-200. */
@Injectable()
export class ListeningQueriesService {
  constructor(
    private readonly repo: ListeningQueriesRepository,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ListeningQueriesService.name);
  }

  list(projectId: string, q: ListeningQueryListQuery): Promise<ListeningQueryPage> {
    return this.repo.list(projectId, q);
  }

  /** Returns soft-deleted queries too (history drill-down, US-035). */
  async get(projectId: string, id: string): Promise<ListeningQuery> {
    return this.repo.toDto(await this.load(projectId, id));
  }

  async create(ctx: Ctx, body: CreateListeningQueryBody): Promise<ListeningQuery> {
    // BR-004 strip '#', BR-005 searchMode from queryType
    const { queryValue, searchMode } = normalizeQuery(body);
    await this.assertNoDuplicate(ctx.projectId, body.queryType, queryValue);
    const now = new Date();
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await this.repo.create(
          {
            id: uuidv7(),
            projectId: ctx.projectId,
            platform: "threads",
            displayName: body.displayName,
            queryValue,
            queryType: body.queryType,
            searchMode,
            scheduledSearchType: "RECENT", // BR-008
            enabled: body.enabled,
            excludeTerms: body.excludeTerms,
            includeTerms: body.includeTerms,
            pollIntervalSeconds: body.pollIntervalSeconds,
            overlapSeconds: body.overlapSeconds,
            initialBackfillDays: body.initialBackfillDays,
            createdBy: ctx.user.id,
            nextRunAt: body.enabled ? now : null, // FR-056: schedule immediately when enabled
          },
          tx,
        );
        await this.record(ctx, "query.created", created.id, tx, {
          queryValue,
          queryType: body.queryType,
          enabled: body.enabled,
          after: {
            displayName: body.displayName,
            pollIntervalSeconds: body.pollIntervalSeconds,
            overlapSeconds: body.overlapSeconds,
            initialBackfillDays: body.initialBackfillDays,
            excludeTerms: body.excludeTerms,
            includeTerms: body.includeTerms,
          },
        });
        return created;
      });
      return this.repo.toDto(row);
    } catch (e: unknown) {
      throw await this.mapRace(e, ctx.projectId, body.queryType, queryValue);
    }
  }

  async update(ctx: Ctx, id: string, patch: UpdateListeningQueryBody): Promise<ListeningQuery> {
    const row = await this.load(ctx.projectId, id);
    if (row.deletedAt) throw AppError.notFound("Listening query"); // must restore first
    const changes = diff(row, patch);
    const keys = Object.keys(changes);
    if (keys.length === 0) return this.repo.toDto(row); // no-op: no write, no audit

    const data: Prisma.ListeningQueryUncheckedUpdateInput = {};
    for (const k of keys) Object.assign(data, { [k]: changes[k]?.after });
    const enabledChange = changes.enabled;
    // FR-055: re-enabling schedules the next run now; disabling keeps next_run_at (claim filters enabled).
    if (enabledChange && enabledChange.after === true) data.nextRunAt = new Date();
    const otherChanges = Object.fromEntries(Object.entries(changes).filter(([k]) => k !== "enabled"));

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await this.repo.update(id, data, tx);
      // Shape { fields, before, after } stays within the audit sanitizer depth limit (arrays survive).
      if (Object.keys(otherChanges).length > 0)
        await this.record(ctx, "query.updated", id, tx, toAuditDiff(otherChanges));
      if (enabledChange)
        await this.record(ctx, enabledChange.after ? "query.enabled" : "query.disabled", id, tx, {
          enabled: enabledChange.after,
          ...toAuditDiff({ enabled: enabledChange }),
        });
      return u;
    });
    return this.repo.toDto(updated);
  }

  /** FR-057 / BR-010: soft delete only — matches, jobs and posts are kept; `enabled` is untouched. Idempotent. */
  async softDelete(ctx: Ctx, id: string): Promise<void> {
    const row = await this.load(ctx.projectId, id);
    if (row.deletedAt) return;
    await this.prisma.$transaction(async (tx) => {
      await this.repo.update(id, { deletedAt: new Date() }, tx);
      await this.record(ctx, "query.deleted", id, tx, { queryValue: row.queryValue, queryType: row.queryType });
    });
  }

  /** FR-057: restore; 409 if an active duplicate was created meanwhile. Idempotent on non-deleted queries. */
  async restore(ctx: Ctx, id: string): Promise<ListeningQuery> {
    const row = await this.load(ctx.projectId, id);
    if (!row.deletedAt) return this.repo.toDto(row);
    await this.assertNoDuplicate(ctx.projectId, row.queryType, row.queryValue, id);
    try {
      const restored = await this.prisma.$transaction(async (tx) => {
        const r = await this.repo.update(
          id,
          { deletedAt: null, ...(row.enabled ? { nextRunAt: new Date() } : {}) },
          tx,
        );
        await this.record(ctx, "query.restored", id, tx, {
          queryValue: row.queryValue,
          queryType: row.queryType,
          enabled: row.enabled,
        });
        return r;
      });
      return this.repo.toDto(restored);
    } catch (e: unknown) {
      throw await this.mapRace(e, ctx.projectId, row.queryType, row.queryValue, id);
    }
  }

  private async load(projectId: string, id: string): Promise<ListeningQueryRow> {
    const row = await this.repo.findById(projectId, id);
    if (!row) throw AppError.notFound("Listening query");
    return row;
  }

  private async assertNoDuplicate(
    projectId: string,
    queryType: ListeningQueryRow["queryType"],
    queryValue: string,
    excludeId?: string,
  ): Promise<void> {
    const existingId = await this.repo.findActiveDuplicate(projectId, queryType, queryValue, excludeId);
    if (existingId) throw duplicate(existingId);
  }

  /** BR-006 race: P2002 from the partial unique index → look up the winner outside the aborted transaction. */
  private async mapRace(
    e: unknown,
    projectId: string,
    queryType: ListeningQueryRow["queryType"],
    queryValue: string,
    excludeId?: string,
  ): Promise<unknown> {
    if (!isUniqueViolation(e)) return e;
    const existingId = await this.repo.findActiveDuplicate(projectId, queryType, queryValue, excludeId);
    this.logger.info({ projectId, existingId }, "listening query duplicate race");
    return existingId ? duplicate(existingId) : new AppError("QUERY_DUPLICATE", "Listening query already exists");
  }

  private record(
    ctx: Ctx,
    action: "query.created" | "query.updated" | "query.enabled" | "query.disabled" | "query.deleted" | "query.restored",
    entityId: string,
    tx: Prisma.TransactionClient,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.record(
      {
        projectId: ctx.projectId,
        actorUserId: ctx.user.id,
        requestId: ctx.requestId,
        action,
        entityType: ENTITY,
        entityId,
        metadata,
      },
      tx,
    );
  }
}

function duplicate(existingId: string): AppError {
  return new AppError("QUERY_DUPLICATE", "An active listening query with the same value and type exists", {
    existingId,
  });
}

export function toAuditDiff(changes: Record<string, FieldChange>): {
  fields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  const entries = Object.entries(changes);
  return {
    fields: entries.map(([k]) => k),
    before: Object.fromEntries(entries.map(([k, v]) => [k, v.before])),
    after: Object.fromEntries(entries.map(([k, v]) => [k, v.after])),
  };
}

/** Only fields whose value actually changes; arrays compared element-wise in order. */
export function diff(row: ListeningQueryRow, patch: UpdateListeningQueryBody): Record<string, FieldChange> {
  const out: Record<string, FieldChange> = {};
  for (const [key, after] of Object.entries(patch)) {
    if (after === undefined) continue;
    const before: unknown = row[key as keyof UpdateListeningQueryBody];
    if (!sameValue(before, after)) out[key] = { before, after };
  }
  return out;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return a === b;
}
