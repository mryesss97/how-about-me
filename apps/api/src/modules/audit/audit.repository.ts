import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import type { AuditLog } from "@how-about-me/contracts";
import { decodeCursor, encodeCursor } from "../../common/pagination/cursor";
import { AppError } from "../../common/errors/app.error";
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

  async list(projectId: string, q: AuditListQuery): Promise<AuditListPage> {
    const where = buildAuditWhere(projectId, q);
    const cursor = decodeCursor(q.cursor);
    const keyset: Prisma.AuditLogWhereInput = cursor ? cursorWhere(cursor) : {};
    const rows = await this.prisma.auditLog.findMany({
      where: { AND: [where, keyset] },
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
    });
    const page = rows.slice(0, q.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > q.limit && last ? encodeCursor({ key: last.createdAt.toISOString(), id: last.id }) : null;
    const result: AuditListPage = { items: page.map(toAuditLog), nextCursor };
    if (q.count) result.totalCount = await this.prisma.auditLog.count({ where });
    return result;
  }
}

/** Filters: project scope always; action exact; actor; from inclusive, to exclusive (UTC instants). */
export function buildAuditWhere(projectId: string, q: AuditListQuery): Prisma.AuditLogWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (q.from) createdAt.gte = new Date(q.from);
  if (q.to) createdAt.lt = new Date(q.to);
  return {
    projectId,
    ...(q.action ? { action: q.action } : {}),
    ...(q.actorUserId ? { actorUserId: q.actorUserId } : {}),
    ...(q.from || q.to ? { createdAt } : {}),
  };
}

/** Keyset on (createdAt desc, id desc). */
export function cursorWhere(c: { key: string; id: string }): Prisma.AuditLogWhereInput {
  const at = new Date(c.key);
  if (Number.isNaN(at.getTime())) throw new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
  return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: c.id } }] };
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
