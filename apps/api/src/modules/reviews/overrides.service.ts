import type { CreateOverrideBody, Override } from "@how-about-me/contracts";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app.error";
import { AuditService } from "../audit/audit.service";
import { toOverrideDto, unwrapValue } from "./overrides.mapper";
import { isActiveOverrideConflict, type OverrideRow, OverridesRepository, type Tx } from "./overrides.repository";

const AUDIT_ENTITY = "analysis_override";

/** intents/topics: dedupe, keep first-seen order; `[]` is a valid "no labels" value. */
export function normalizeOverrideValue(body: CreateOverrideBody): string | string[] {
  return Array.isArray(body.value) ? [...new Set<string>(body.value)] : body.value;
}

/**
 * Analyst overrides — T-142, FR-191/192/193, BR-025 (effective = active override > latest AI), FR-200 (audit).
 * AI analyses are never modified (BR-003); overrides are revoked, never deleted.
 */
@Injectable()
export class OverridesService {
  constructor(
    private readonly repo: OverridesRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * FR-191: create an override for one field. An active override on the same (post, field) is revoked and
   * replaced in the same transaction (doc 07 §10) → audit `override.revoked` then `override.created`.
   * `previous_value` = AI value of the current analysis (null when unanalysed). Post row lock serializes
   * concurrent requests; a leftover P2002 from the partial unique index maps to 409 OVERRIDE_CONFLICT.
   */
  async create(
    projectId: string,
    mentionId: string,
    body: CreateOverrideBody,
    actorUserId: string,
    requestId: string | null,
    now: Date = new Date(),
  ): Promise<Override> {
    try {
      return await this.repo.transaction(async (tx) => {
        const post = await this.repo.lockPostInProject(tx, projectId, mentionId);
        if (!post) throw AppError.notFound("Mention");
        const value = normalizeOverrideValue(body);
        const ai = post.currentAnalysisId ? await this.repo.aiValue(tx, post.currentAnalysisId, body.field) : null;
        const active = await this.repo.findActive(tx, post.id, body.field);
        if (active) await this.revokeAndAudit(tx, projectId, active, actorUserId, requestId, now);
        const row = await this.repo.insert(tx, {
          id: randomUUID(),
          postId: post.id,
          projectId,
          analysisId: post.currentAnalysisId,
          field: body.field,
          previousValue: ai == null ? null : { value: ai },
          overrideValue: { value },
          reason: body.reason ? body.reason : null,
          reviewedBy: actorUserId,
        });
        // FR-200: field/values/reason + post id (#393), never post text.
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: "override.created",
            entityType: AUDIT_ENTITY,
            entityId: row.id,
            metadata: { field: body.field, before: ai, after: value, reason: row.reason, postIds: [post.id] },
            requestId,
          },
          tx,
        );
        const users = await this.repo.usersById([actorUserId], tx);
        return toOverrideDto({ row, users });
      });
    } catch (e) {
      if (isActiveOverrideConflict(e)) {
        throw new AppError("OVERRIDE_CONFLICT", "Another override for this field was saved at the same time");
      }
      throw e;
    }
  }

  /** FR-193: revoke keeps the row; already revoked → idempotent no-op (no audit). */
  revoke(
    projectId: string,
    mentionId: string,
    overrideId: string,
    actorUserId: string,
    requestId: string | null,
    now: Date = new Date(),
  ): Promise<void> {
    return this.repo.transaction(async (tx) => {
      const post = await this.repo.lockPostInProject(tx, projectId, mentionId);
      if (!post) throw AppError.notFound("Mention");
      const row = await this.repo.findById(tx, post.id, overrideId);
      if (!row) throw AppError.notFound("Override");
      if (row.revokedAt) return;
      await this.revokeAndAudit(tx, projectId, row, actorUserId, requestId, now);
    });
  }

  private async revokeAndAudit(
    tx: Tx,
    projectId: string,
    row: OverrideRow,
    actorUserId: string,
    requestId: string | null,
    now: Date,
  ): Promise<void> {
    await this.repo.revoke(tx, row.id, actorUserId, now);
    await this.audit.record(
      {
        projectId,
        actorUserId,
        action: "override.revoked",
        entityType: AUDIT_ENTITY,
        entityId: row.id,
        // FR-200 / #393: post id lets the audit log link to the mention.
        metadata: { field: row.field, before: unwrapValue(row.overrideValue), postIds: [row.postId] },
        requestId,
      },
      tx,
    );
  }
}
