import { z } from "zod";
import {
  csvArray,
  CursorPaginationQuerySchema,
  IsoDateTimeSchema,
  UuidSchema,
  pageOf,
  withDateRange,
} from "./common.js";
import { AnalysisStatusSchema, AnalysisTriggerSchema } from "./enums.js";

/** Ops view of analysis_runs — docs/02-architecture/05-api-contract.md §9, data model §4.10. */
export const AnalysisRunSchema = z.object({
  id: UuidSchema,
  postId: UuidSchema,
  status: AnalysisStatusSchema,
  trigger: AnalysisTriggerSchema,
  effectiveVersion: z.string(),
  attemptCount: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  startedAt: IsoDateTimeSchema.nullable(),
  completedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type AnalysisRun = z.infer<typeof AnalysisRunSchema>;

export const AnalysisRunsListQuerySchema = withDateRange(
  CursorPaginationQuerySchema.extend({
    status: csvArray(AnalysisStatusSchema).default([]),
    from: IsoDateTimeSchema.optional(),
    to: IsoDateTimeSchema.optional(),
  }),
);
export type AnalysisRunsListQuery = z.infer<typeof AnalysisRunsListQuerySchema>;
export const AnalysisRunsPageSchema = pageOf(AnalysisRunSchema);

/** POST …/analysis-runs/:id/retry → 202. */
export const RetryAnalysisRunResponseSchema = z.object({ runId: UuidSchema, status: z.literal("pending") });

/** POST …/analysis-runs/retry-failed. */
export const RetryFailedBodySchema = z.object({ limit: z.number().int().min(1).max(500).default(100) });
export type RetryFailedBody = z.infer<typeof RetryFailedBodySchema>;
export const RetryFailedResponseSchema = z.object({ enqueued: z.number().int().nonnegative() });
