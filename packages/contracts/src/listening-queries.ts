import { z } from "zod";
import {
  csvArray,
  CursorPaginationQuerySchema,
  IsoDateTimeSchema,
  LastErrorSchema,
  UserRefSchema,
  UuidSchema,
  pageOf,
} from "./common.js";
import { JobStatusSchema, QueryTypeSchema, SearchModeSchema, SearchTypeSchema } from "./enums.js";

/** FR-052 validation rules. Leading `#` is stripped (BR-004). */
export const QueryValueSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/^#+/, "").trim())
  .pipe(z.string().min(1).max(100));

const TermsSchema = z.array(z.string().trim().min(1).max(100)).max(50);

/** Mutable fields without defaults — reused by create (with defaults) and PATCH (partial, no default injection). */
const QueryMutableFieldsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  excludeTerms: TermsSchema,
  includeTerms: TermsSchema,
  pollIntervalSeconds: z.number().int().min(60).max(86400),
  overlapSeconds: z.number().int().min(0).max(86400),
  initialBackfillDays: z.number().int().min(0).max(30),
  enabled: z.boolean(),
});

export const CreateListeningQueryBodySchema = QueryMutableFieldsSchema.extend({
  queryValue: QueryValueSchema,
  queryType: QueryTypeSchema,
  excludeTerms: TermsSchema.default([]),
  includeTerms: TermsSchema.default([]),
  pollIntervalSeconds: z.number().int().min(60).max(86400).default(600),
  overlapSeconds: z.number().int().min(0).max(86400).default(1200),
  initialBackfillDays: z.number().int().min(0).max(30).default(1),
  enabled: z.boolean().default(true),
});
export type CreateListeningQueryBody = z.infer<typeof CreateListeningQueryBodySchema>;

/** FR-054: queryValue/queryType are immutable — intentionally absent. No defaults here so a PATCH never overwrites unsent fields. */
export const UpdateListeningQueryBodySchema = QueryMutableFieldsSchema.partial().refine(
  (b) => Object.keys(b).length > 0,
  { message: "Empty update" },
);
export type UpdateListeningQueryBody = z.infer<typeof UpdateListeningQueryBodySchema>;

export const ListeningQueryListQuerySchema = CursorPaginationQuerySchema.extend({
  enabled: z.coerce.boolean().optional(),
  type: QueryTypeSchema.optional(),
  includeDeleted: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ListeningQuerySchema = z.object({
  id: UuidSchema,
  displayName: z.string(),
  queryValue: z.string(),
  queryType: QueryTypeSchema,
  searchMode: SearchModeSchema,
  scheduledSearchType: SearchTypeSchema,
  enabled: z.boolean(),
  excludeTerms: z.array(z.string()),
  includeTerms: z.array(z.string()),
  pollIntervalSeconds: z.number().int(),
  overlapSeconds: z.number().int(),
  initialBackfillDays: z.number().int(),
  nextRunAt: IsoDateTimeSchema.nullable(),
  lastRunAt: IsoDateTimeSchema.nullable(),
  lastSuccessfulSyncAt: IsoDateTimeSchema.nullable(),
  lastError: LastErrorSchema,
  lastJob: z
    .object({
      id: UuidSchema,
      status: JobStatusSchema,
      recordsFetched: z.number().int(),
      recordsInserted: z.number().int(),
      completedAt: IsoDateTimeSchema.nullable(),
    })
    .nullable(),
  matchedPosts: z.object({ total: z.number().int(), last24h: z.number().int() }),
  createdBy: UserRefSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  deletedAt: IsoDateTimeSchema.nullable(),
});
export type ListeningQuery = z.infer<typeof ListeningQuerySchema>;
export const ListeningQueryPageSchema = pageOf(ListeningQuerySchema);

export const RunQueryResponseSchema = z.object({ jobId: UuidSchema, status: z.literal("queued") });
export const BackfillBodySchema = z
  .object({ since: IsoDateTimeSchema, until: IsoDateTimeSchema, searchType: SearchTypeSchema.default("RECENT") })
  .refine((b) => new Date(b.until) > new Date(b.since), { message: "until must be after since", path: ["until"] });
export type BackfillBody = z.infer<typeof BackfillBodySchema>;

export const QueryIdsFilterSchema = csvArray(UuidSchema);
