import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PinoLogger } from "nestjs-pino";
import { type AuditAction, sanitizeAuditMetadata } from "./audit-metadata";
import { type AuditListPage, type AuditListQuery, AuditRepository } from "./audit.repository";

export type AuditRecordInput = {
  projectId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
  requestId?: string | null;
};

/**
 * Audit log writer/reader — FR-200 (record, no secrets), FR-201 (admin list).
 * Immutable: there is intentionally no update/delete method. Call `record` from services, not controllers.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly repo: AuditRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  /**
   * Inside a transaction (`tx`) failures propagate so the mutation fails with it.
   * Outside a transaction failures are logged at warn (without metadata) and never block the caller.
   */
  async record(input: AuditRecordInput, tx?: Prisma.TransactionClient): Promise<void> {
    const row = {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: sanitizeAuditMetadata(input.metadata),
      requestId: input.requestId ?? null,
    };
    if (tx) return this.repo.create(row, tx);
    try {
      await this.repo.create(row);
    } catch (err: unknown) {
      this.logger.warn(
        {
          action: row.action,
          projectId: row.projectId,
          requestId: row.requestId,
          errName: err instanceof Error ? err.name : "unknown",
        },
        "audit record failed",
      );
    }
  }

  list(projectId: string, query: AuditListQuery): Promise<AuditListPage> {
    return this.repo.list(projectId, query);
  }
}
