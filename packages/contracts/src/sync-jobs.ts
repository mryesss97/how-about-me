import { z } from "zod";
import { csvArray, CursorPaginationQuerySchema, IsoDateTimeSchema, UuidSchema, pageOf } from "./common.js";
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

export const SyncJobsListQuerySchema = CursorPaginationQuerySchema.extend({
  queryId: UuidSchema.optional(),
  status: csvArray(JobStatusSchema).default([]),
  trigger: csvArray(JobTriggerSchema).default([]),
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
});
export const SyncJobsPageSchema = pageOf(SyncJobSchema);
