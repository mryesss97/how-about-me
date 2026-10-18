import { z } from "zod";
import {
  CursorPaginationQuerySchema,
  IsoDateTimeSchema,
  UserRefSchema,
  UuidSchema,
  pageOf,
  withDateRange,
} from "./common.js";

/** Audit actions — docs/02-architecture/08-security-secrets.md §6 (FR-200). */
export const AUDIT_ACTIONS = [
  "project.updated",
  "member.added",
  "member.role_changed",
  "member.removed",
  "integration.updated",
  "integration.verified",
  "integration.disconnected",
  "integration.refresh_failed",
  "query.created",
  "query.updated",
  "query.enabled",
  "query.disabled",
  "query.deleted",
  "query.restored",
  "query.run_requested",
  "query.backfill_requested",
  "analysis.reanalyze_requested",
  "analysis.bulk_reanalyze_requested",
  "analysis.retry_requested",
  "override.created",
  "override.revoked",
  "review.marked",
  "mentions.exported",
  "analysis_settings.updated",
  "sync_job.retry_requested",
  "data.purged",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AuditLogSchema = z.object({
  id: UuidSchema,
  action: z.string(),
  actor: UserRefSchema.nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  requestId: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type AuditLog = z.infer<typeof AuditLogSchema>;
export const AuditLogsQuerySchema = withDateRange(
  CursorPaginationQuerySchema.extend({
    action: z.string().max(100).optional(),
    actorUserId: UuidSchema.optional(),
    from: IsoDateTimeSchema.optional(),
    to: IsoDateTimeSchema.optional(),
  }),
);
export const AuditLogsPageSchema = pageOf(AuditLogSchema);
