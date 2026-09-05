import { z } from "zod";
import { CursorPaginationQuerySchema, IsoDateTimeSchema, UuidSchema, pageOf } from "./common.js";
import {
  AnalysisStatusSchema,
  AnalysisTriggerSchema,
  ConfidenceBandSchema,
  IntentLabelSchema,
  LanguageCodeSchema,
  PlatformSchema,
  QueryTypeSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
} from "./enums.js";
import { AnalysisFiltersSchema } from "./filters.js";

export const MENTION_SORTS = ["newest", "oldest", "safety_desc", "confidence_asc", "relevance_desc"] as const;
export const MentionSortSchema = z.enum(MENTION_SORTS);

export const MentionsListQuerySchema = AnalysisFiltersSchema.extend({
  q: z.string().trim().max(200).optional(),
  reviewStatus: z.enum(["reviewed", "unreviewed"]).optional(),
  sort: MentionSortSchema.default("newest"),
}).extend(CursorPaginationQuerySchema.shape);
export type MentionsListQuery = z.infer<typeof MentionsListQuerySchema>;

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
