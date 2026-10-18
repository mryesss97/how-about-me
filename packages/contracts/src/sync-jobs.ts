import { z } from "zod";
import {
  csvArray,
  CursorPaginationQuerySchema,
  IsoDateTimeSchema,
  QueuedJobResponseSchema,
  UuidSchema,
  pageOf,
  withDateRange,
} from "./common.js";
import { JobStatusSchema, JobTriggerSchema, SearchModeSchema, SearchTypeSchema } from "./enums.js";

export const SyncJobSchema = z.object({
  id: UuidSchema,
  queryId: UuidSchema.nullable(),
  status: JobStatusSchema,
  trigger: JobTriggerSchema,
  searchType: SearchTypeSchema,
  searchMode: SearchModeSchema,
  windowSince: IsoDateTimeSchema.nullable(),
  windowUntil: IsoDateTimeSchema.nullable(),
  startedAt: IsoDateTimeSchema.nullable(),
  completedAt: IsoDateTimeSchema.nullable(),
  pagesFetched: z.number().int(),
  recordsFetched: z.number().int(),
  recordsInserted: z.number().int(),
  recordsUpdated: z.number().int(),
  recordsDuplicated: z.number().int(),
  recordsInvalid: z.number().int(),
  recordsExcluded: z.number().int(),
  providerRequests: z.number().int(),
  rateLimitEvents: z.number().int(),
  lastCursor: z.string().nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  createdAt: IsoDateTimeSchema,
});
export type SyncJob = z.infer<typeof SyncJobSchema>;

export const SyncJobsListQuerySchema = withDateRange(
  CursorPaginationQuerySchema.extend({
    queryId: UuidSchema.optional(),
    status: csvArray(JobStatusSchema).default([]),
    trigger: csvArray(JobTriggerSchema).default([]),
    from: IsoDateTimeSchema.optional(),
    to: IsoDateTimeSchema.optional(),
  }),
);
export const SyncJobsPageSchema = pageOf(SyncJobSchema);
/** `GET …/sync-jobs/:id` returns the full job object plus the last provider usage snapshot (raw headers never exposed). */
export const SyncJobDetailSchema = SyncJobSchema.extend({
  providerUsage: z
    .object({
      remaining: z.number().nullable(),
      resetAt: IsoDateTimeSchema.nullable(),
      observedAt: IsoDateTimeSchema,
    })
    .nullable(),
});
export type SyncJobDetail = z.infer<typeof SyncJobDetailSchema>;
export type SyncJobsListQuery = z.infer<typeof SyncJobsListQuerySchema>;
/** `POST …/sync-jobs/:id/retry` → 202. */
export const RetrySyncJobResponseSchema = QueuedJobResponseSchema;
