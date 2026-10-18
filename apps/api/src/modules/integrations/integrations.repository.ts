import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { ConnectionRow } from "./integrations.mapper";

export type ConnectionPatch = Partial<
  Pick<
    ConnectionRow,
    | "status"
    | "accountIdentifier"
    | "grantedScopes"
    | "tokenExpiresAt"
    | "lastVerifiedAt"
    | "lastErrorCode"
    | "lastErrorMessage"
    | "lastErrorAt"
  >
>;

/** `integration_connections` access. Never selects `secret` — only ThreadsTokenStore reads it (BR-036). */
@Injectable()
export class IntegrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findThreads(projectId: string, tx?: Prisma.TransactionClient): Promise<ConnectionRow | null> {
    return (tx ?? this.prisma).integrationConnection.findUnique({
      where: { projectId_platform: { projectId, platform: "threads" } },
    });
  }

  /** Upsert on the `(project_id, platform)` unique key, so two concurrent PUTs never create two rows. */
  upsertThreads(projectId: string, patch: ConnectionPatch, tx: Prisma.TransactionClient): Promise<ConnectionRow> {
    return tx.integrationConnection.upsert({
      where: { projectId_platform: { projectId, platform: "threads" } },
      create: { id: randomUUID(), projectId, platform: "threads", ...patch },
      update: patch,
    });
  }

  update(id: string, patch: ConnectionPatch, tx?: Prisma.TransactionClient): Promise<ConnectionRow> {
    return (tx ?? this.prisma).integrationConnection.update({ where: { id }, data: patch });
  }

  /**
   * FR-045/FR-085: provider auth failure moves a `connected` connection to `expired`/`permission_error`.
   * Conditional on `status = connected` so a stale job never overwrites a newer PUT/verify. Returns rows changed.
   */
  async markAuthFailure(
    projectId: string,
    status: "expired" | "permission_error",
    code: string,
    message: string,
    at: Date,
  ): Promise<number> {
    const res = await this.prisma.integrationConnection.updateMany({
      where: { projectId, platform: "threads", status: "connected" },
      data: { status, lastErrorCode: code, lastErrorMessage: message, lastErrorAt: at },
    });
    return res.count;
  }

  /** FR-046: connected Threads connections whose token expires before `before`. */
  findExpiringThreads(before: Date): Promise<Pick<ConnectionRow, "id" | "projectId" | "tokenExpiresAt">[]> {
    return this.prisma.integrationConnection.findMany({
      where: { platform: "threads", status: "connected", tokenExpiresAt: { not: null, lte: before } },
      select: { id: true, projectId: true, tokenExpiresAt: true },
      orderBy: { id: "asc" },
    });
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
