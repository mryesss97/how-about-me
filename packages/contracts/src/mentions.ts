import { z } from "zod";
import {
  csvArray,
  CursorPaginationQuerySchema,
  IsoDateTimeSchema,
  UserRefSchema,
  UuidSchema,
  pageOf,
  withDateRange,
} from "./common.js";
import {
  AnalysisStatusSchema,
  AnalysisTriggerSchema,
  ConfidenceBandSchema,
  IntentLabelSchema,
  LanguageCodeSchema,
  OverrideFieldSchema,
  PlatformSchema,
  QueryTypeSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
} from "./enums.js";
import { AnalysisFiltersBaseSchema } from "./filters.js";

export const MENTION_SORTS = ["newest", "oldest", "safety_desc", "confidence_asc", "relevance_desc"] as const;
export const MentionSortSchema = z.enum(MENTION_SORTS);

/** List filters without pagination — shared by list, bulk reanalyze and export. */
const MentionsFiltersBaseSchema = AnalysisFiltersBaseSchema.extend({
  q: z.string().trim().max(200).optional(),
  reviewStatus: csvArray(z.enum(["reviewed", "unreviewed"])).default([]),
  sort: MentionSortSchema.default("newest"),
});

export const MentionsListQuerySchema = withDateRange(
  MentionsFiltersBaseSchema.extend(CursorPaginationQuerySchema.shape),
);
export type MentionsListQuery = z.infer<typeof MentionsListQuerySchema>;

/** `GET …/mentions/export.csv` (P1): list filters, no cursor/limit/count. */
export const MentionsExportQuerySchema = withDateRange(MentionsFiltersBaseSchema);
export type MentionsExportQuery = z.infer<typeof MentionsExportQuerySchema>;

const Labeled = <T extends z.ZodTypeAny>(label: T) =>
  z.object({ label, confidence: z.number().min(0).max(1).nullable() });

export const MentionAnalysisSummarySchema = z.object({
  status: AnalysisStatusSchema,
  source: z.enum(["ai", "analyst", "mixed"]),
  relevance: Labeled(RelevanceLabelSchema).nullable(),
  sentiment: Labeled(SentimentLabelSchema).nullable(),
  safety: z.object({ level: SafetyLevelSchema }).nullable(),
  intents: z.array(Labeled(IntentLabelSchema)),
  topics: z.array(Labeled(TopicLabelSchema)),
  language: LanguageCodeSchema.nullable(),
  summary: z.string().nullable(),
  overallConfidence: z.number().min(0).max(1).nullable(),
  confidenceBand: ConfidenceBandSchema.nullable(),
  hasOverride: z.boolean(),
  errorCode: z.string().nullable().optional(),
});

export const MentionListItemSchema = z.object({
  id: UuidSchema,
  platform: PlatformSchema,
  platformPostId: z.string(),
  username: z.string().nullable(),
  permalink: z.string().nullable(),
  publishedAt: IsoDateTimeSchema,
  text: z.string().nullable(),
  mediaType: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  hasReplies: z.boolean().nullable(),
  isQuotePost: z.boolean().nullable(),
  matchedQueries: z.array(
    z.object({ id: UuidSchema, displayName: z.string(), queryType: QueryTypeSchema, excludedByTerms: z.boolean() }),
  ),
  analysis: MentionAnalysisSummarySchema,
});
export type MentionListItem = z.infer<typeof MentionListItemSchema>;
export const MentionsPageSchema = pageOf(MentionListItemSchema);

export const AnalysisVersionsSchema = z.object({
  classifierProvider: z.string().nullable(),
  classifierModel: z.string().nullable(),
  promptVersion: z.string().nullable(),
  taxonomyVersion: z.string().nullable(),
  safetyProvider: z.string().nullable(),
  safetyModel: z.string().nullable(),
  safetyPolicyVersion: z.string().nullable(),
});

export const OverrideSchema = z.object({
  id: UuidSchema,
  field: OverrideFieldSchema,
  previousValue: z.unknown(),
  value: z.unknown(),
  reason: z.string().nullable(),
  reviewedBy: UserRefSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable(),
});
export type Override = z.infer<typeof OverrideSchema>;

export const MentionDetailSchema = MentionListItemSchema.extend({
  ownerId: z.string().nullable(),
  shortcode: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  altText: z.string().nullable(),
  linkAttachmentUrl: z.string().nullable(),
  quotedPostId: z.string().nullable(),
  repostedPostId: z.string().nullable(),
  firstSeenAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema,
  revision: z.number().int(),
  contentHash: z.string(),
  analysis: MentionAnalysisSummarySchema.extend({
    relevanceExplanation: z.string().nullable(),
    safetyCategoryScores: z.record(z.string(), z.number()).nullable(),
    safetyTriggered: z
      .array(z.object({ category: z.string(), score: z.number(), level: z.enum(["sensitive", "severe"]) }))
      .nullable(),
    versions: AnalysisVersionsSchema.nullable(),
    analyzedAt: IsoDateTimeSchema.nullable(),
    tokens: z.object({ input: z.number().int().nullable(), output: z.number().int().nullable() }).nullable(),
    estimatedCostUsd: z.number().nullable(),
  }),
  overrides: z.array(OverrideSchema).optional(),
  runs: z.array(
    z.object({
      id: UuidSchema,
      status: AnalysisStatusSchema,
      trigger: AnalysisTriggerSchema,
      effectiveVersion: z.string(),
      createdAt: IsoDateTimeSchema,
      completedAt: IsoDateTimeSchema.nullable(),
      errorCode: z.string().nullable(),
    }),
  ),
});
export type MentionDetail = z.infer<typeof MentionDetailSchema>;

export const ReanalyzeResponseSchema = z.object({ runId: UuidSchema, status: z.literal("pending") });
export type ReanalyzeResponse = z.infer<typeof ReanalyzeResponseSchema>;

/** POST …/mentions/reanalyze (P1): list filters + dryRun. */
export const BulkReanalyzeBodySchema = withDateRange(
  MentionsFiltersBaseSchema.extend({ dryRun: z.boolean().default(false) }),
);
export type BulkReanalyzeBody = z.infer<typeof BulkReanalyzeBodySchema>;
export const BulkReanalyzeResponseSchema = z.object({
  matched: z.number().int().nonnegative(),
  enqueued: z.number().int().nonnegative(),
  cap: z.number().int().nonnegative(),
});

/** Override value per field — docs/02-architecture/04-data-model.md §4.13. */
const OverrideReason = z.string().trim().max(500).optional();
export const CreateOverrideBodySchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("relevance"), value: RelevanceLabelSchema, reason: OverrideReason }),
  z.object({ field: z.literal("sentiment"), value: SentimentLabelSchema, reason: OverrideReason }),
  z.object({ field: z.literal("safety_level"), value: SafetyLevelSchema, reason: OverrideReason }),
  z.object({ field: z.literal("intents"), value: z.array(IntentLabelSchema).max(20), reason: OverrideReason }),
  z.object({ field: z.literal("topics"), value: z.array(TopicLabelSchema).max(20), reason: OverrideReason }),
]);
export type CreateOverrideBody = z.infer<typeof CreateOverrideBodySchema>;
