import { z } from "zod";
import { CursorPaginationQuerySchema, IsoDateTimeSchema, UserRefSchema, UuidSchema, pageOf } from "./common.js";
import {
  AnalysisStatusSchema,
  ConfidenceBandSchema,
  PlatformSchema,
  RelevanceLabelSchema,
  SentimentLabelSchema,
} from "./enums.js";

/** Review queue — FR-195, T-144 (docs/02-architecture/05-api-contract.md "Reviews"). Fixed display order. */
export const REVIEW_REASONS = ["failed", "uncertain", "low_confidence"] as const;
export const ReviewReasonSchema = z.enum(REVIEW_REASONS);
export type ReviewReason = z.infer<typeof ReviewReasonSchema>;

/** BR-040: reviewed = `reviewed_at` ≥ latest run `created_at`. */
export const REVIEW_STATUSES = ["unreviewed", "reviewed"] as const;
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewQueueQuerySchema = z.object({
  reason: ReviewReasonSchema.optional(),
  status: ReviewStatusSchema.default("unreviewed"),
  ...CursorPaginationQuerySchema.shape,
});
export type ReviewQueueQuery = z.infer<typeof ReviewQueueQuerySchema>;

export const ReviewQueueItemSchema = z.object({
  id: UuidSchema,
  platform: PlatformSchema,
  platformPostId: z.string(),
  username: z.string().nullable(),
  permalink: z.string().nullable(),
  publishedAt: IsoDateTimeSchema,
  text: z.string().nullable(),
  reasons: z.array(ReviewReasonSchema).min(1),
  analysis: z.object({
    status: AnalysisStatusSchema,
    relevance: RelevanceLabelSchema.nullable(),
    sentiment: SentimentLabelSchema.nullable(),
    overallConfidence: z.number().min(0).max(1).nullable(),
    /** Band of the policy the run was analysed with (doc 08 §8, BR-021) — not a probability (BR-020). */
    confidenceBand: ConfidenceBandSchema.nullable(),
    errorCode: z.string().nullable(),
    hasOverride: z.boolean(),
  }),
  reviewedAt: IsoDateTimeSchema.nullable(),
  reviewedBy: UserRefSchema.nullable(),
});
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

const count = z.number().int().nonnegative();
export const ReviewQueueCountsSchema = z.object({ all: count, uncertain: count, lowConfidence: count, failed: count });
export type ReviewQueueCounts = z.infer<typeof ReviewQueueCountsSchema>;

/** `counts` (for tab badges) follow the requested `status`; omitted when `count=false` or the count timed out. */
export const ReviewQueuePageSchema = pageOf(ReviewQueueItemSchema).extend({
  counts: ReviewQueueCountsSchema.optional(),
});
export type ReviewQueuePage = z.infer<typeof ReviewQueuePageSchema>;

/**
 * Review state of one mention, exposed on mention detail (#339, FR-195, BR-040). Same reason definitions as
 * `GET …/reviews`. On the detail DTO `null` = the post is outside the queue scope (no reason, effective relevance
 * `irrelevant` BR-016, or no non-excluded match BR-007). `status` is computed server-side per BR-040.
 */
export const MentionReviewStateSchema = z.object({
  reasons: z.array(ReviewReasonSchema).min(1),
  status: ReviewStatusSchema,
  reviewedAt: IsoDateTimeSchema.nullable(),
});
export type MentionReviewState = z.infer<typeof MentionReviewStateSchema>;

/** Max ids per mark-reviewed call — keeps audit metadata under AUDIT_MAX_BYTES. */
export const MARK_REVIEWED_MAX = 50;
export const MarkReviewedBodySchema = z.object({ postIds: z.array(UuidSchema).min(1).max(MARK_REVIEWED_MAX) });
export type MarkReviewedBody = z.infer<typeof MarkReviewedBodySchema>;

export const MarkReviewedResponseSchema = z.object({ marked: z.number().int().nonnegative() });
export type MarkReviewedResponse = z.infer<typeof MarkReviewedResponseSchema>;
