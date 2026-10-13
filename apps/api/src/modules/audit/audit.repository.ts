import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { AuditLog } from "@how-about-me/contracts";
import {
  countWhere,
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
  orderByIds,
  pageKeysByCreatedAt,
} from "../../common/pagination/created-at-keyset";
import { PrismaService } from "../../database/prisma.service";
import type { AuditMetadata } from "./audit-metadata";

export type AuditRow = {
  projectId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: AuditMetadata | null;
  requestId: string | null;
};

export type AuditListQuery = {
  cursor?: string;
  limit: number;
  count: boolean;
  action?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
};

export type AuditListPage = { items: AuditLog[]; nextCursor: string | null; totalCount?: number };

/** Append-only access to audit_logs (FR-200/201). No update/delete by design. */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(row: AuditRow, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? this.prisma;
    await db.auditLog.create({
      data: {
        id: uuidv7(),
        ...row,
        metadata: row.metadata === null ? Prisma.DbNull : (row.metadata as Prisma.InputJsonObject),
      },
    });
  }

  /** FR-201 / #188: keyset `(created_at, id) DESC` in SQL (µs precision), then hydrate by id. */
  async list(projectId: string, q: AuditListQuery): Promise<AuditListPage> {
    const cursor = decodeCreatedAtCursor(q.cursor);
    const where = buildAuditWhereSql(projectId, q);
    const keys = await pageKeysByCreatedAt(this.prisma, "audit_logs", where, cursor, q.limit);
    const pageKeys = keys.slice(0, q.limit);
    const ids = pageKeys.map((k) => k.id);
    const rows =
      ids.length === 0
        ? []
        : await this.prisma.auditLog.findMany({
            where: { id: { in: ids } },
            include: { actor: { select: { id: true, displayName: true, email: true } } },
          });
    const last = pageKeys.at(-1);
    const nextCursor = keys.length > q.limit && last ? encodeCreatedAtCursor(last) : null;
    const result: AuditListPage = { items: orderByIds(ids, rows).map(toAuditLog), nextCursor };
    if (q.count) result.totalCount = await countWhere(this.prisma, "audit_logs", where);
    return result;
  }
}

/** Filters: project scope always; action exact; actor; from inclusive, to exclusive (ISO strings keep µs). */
export function buildAuditWhereSql(projectId: string, q: AuditListQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`project_id = ${projectId}::uuid`];
  if (q.action) parts.push(Prisma.sql`action = ${q.action}`);
  if (q.actorUserId) parts.push(Prisma.sql`actor_user_id = ${q.actorUserId}::uuid`);
  if (q.from) parts.push(Prisma.sql`created_at >= ${q.from}::timestamptz`);
  if (q.to) parts.push(Prisma.sql`created_at < ${q.to}::timestamptz`);
  return Prisma.join(parts, " AND ");
}

type DbRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Prisma.JsonValue;
  requestId: string | null;
  createdAt: Date;
  actor: { id: string; displayName: string | null; email: string } | null;
};

export function toAuditLog(r: DbRow): AuditLog {
  const m = r.metadata;
  return {
    id: r.id,
    action: r.action,
    actor: r.actor ? { id: r.actor.id, displayName: r.actor.displayName, email: r.actor.email } : null,
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: m !== null && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : null,
    requestId: r.requestId,
    createdAt: r.createdAt.toISOString(),
  };
}
