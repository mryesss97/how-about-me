import { z } from "zod";
import {
  CursorPaginationQuerySchema,
  IsoDateTimeSchema,
  UserRefSchema,
  UuidSchema,
  pageOf,
  withDateRange,
} from "./common.js";

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
