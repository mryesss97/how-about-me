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

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
