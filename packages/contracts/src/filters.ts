import { normalizePhrase, PHRASE_MAX_LENGTH } from "@how-about-me/taxonomy";
import { z } from "zod";
import {
  csvArray,
  IanaTimezoneSchema,
  IsoDateTimeSchema,
  queryBoolean,
  queryInt,
  UuidSchema,
  withDateRange,
} from "./common.js";
import {
  type AnalysisStatus,
  AnalysisStatusSchema,
  IntentLabelSchema,
  LanguageCodeSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
} from "./enums.js";

/** Key phrase filter value (FR-148): normalised server-side with BR-041 so links always match stored phrases. */
export const PhraseFilterSchema = z
  .string()
  .max(PHRASE_MAX_LENGTH)
  .transform((v) => normalizePhrase(v))
  .pipe(z.string({ error: "Invalid phrase" }));

/** Term filter (BR-042, #273): one term, trimmed, 1–60 chars, normalised with BR-041 like landing terms. */
export const TermFilterSchema = z
  .string()
  .trim()
  .min(1)
  .max(PHRASE_MAX_LENGTH)
  .transform((v) => normalizePhrase(v))
  .pipe(z.string({ error: "Invalid term" }));

/** Shared analytics/mentions filters — docs/02-architecture/05-api-contract.md §6–§7. Default relevance = relevant (BR-016);
 * Mentions also keeps NULL-relevance posts when analysisStatus ⊆ UNLABELLED_ANALYSIS_STATUSES (#328).
 * Unrefined base so resources can `.extend()` it; wrap the final schema with `withDateRange`. */
export const AnalysisFiltersBaseSchema = z.object({
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
  timezone: IanaTimezoneSchema.optional(),
  queryIds: csvArray(UuidSchema).default([]),
  relevance: csvArray(RelevanceLabelSchema).default(["relevant"]),
  sentiment: csvArray(SentimentLabelSchema).default([]),
  safety: csvArray(SafetyLevelSchema).default([]),
  intent: csvArray(IntentLabelSchema).default([]),
  topic: csvArray(TopicLabelSchema).default([]),
  phrase: csvArray(PhraseFilterSchema).default([]),
  term: TermFilterSchema.optional(),
  language: csvArray(LanguageCodeSchema).default([]),
  analysisStatus: csvArray(AnalysisStatusSchema).default([]),
  timeField: z.enum(["published_at", "first_seen_at"]).default("published_at"),
});
export const AnalysisFiltersSchema = withDateRange(AnalysisFiltersBaseSchema);
export type AnalysisFilters = z.infer<typeof AnalysisFiltersSchema>;

export const AnalyticsQueryBaseSchema = AnalysisFiltersBaseSchema.extend({ compare: queryBoolean().default(false) });
export const AnalyticsQuerySchema = withDateRange(AnalyticsQueryBaseSchema);
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

export const TimeseriesQuerySchema = withDateRange(
  AnalyticsQueryBaseSchema.extend({ interval: z.enum(["hour", "day"]).optional() }),
);
export type TimeseriesQuery = z.infer<typeof TimeseriesQuerySchema>;

/** Default of the project setting `phraseMinMentions` (FR-148, #251); a `minMentions` query param overrides it. */
export const DEFAULT_PHRASE_MIN_MENTIONS = 2;
export const DEFAULT_PHRASE_LIMIT = 30;

/** `GET …/analytics/phrases` (FR-148): shared filters + top-N `limit` and `minMentions` threshold (omitted → project setting `phraseMinMentions`, default 2; #251). `compare` ignored. */
export const PhrasesQuerySchema = withDateRange(
  AnalyticsQueryBaseSchema.extend({
    limit: queryInt(1, 100).default(DEFAULT_PHRASE_LIMIT),
    minMentions: queryInt(1, 1000).optional(),
  }),
);
export type PhrasesQuery = z.infer<typeof PhrasesQuerySchema>;

/**
 * Statuses whose posts may have no relevance yet (BR-016 exception, #328). Mentions list/count/export/bulk only —
 * analytics never applies the exception.
 */
export const UNLABELLED_ANALYSIS_STATUSES = [
  "pending",
  "processing",
  "failed",
] as const satisfies readonly AnalysisStatus[];

/** BR-016 exception (#328): true when the status filter is non-empty and holds only unlabelled statuses. */
export function isUnlabelledStatusFilter(statuses: readonly AnalysisStatus[]): boolean {
  const unlabelled: readonly AnalysisStatus[] = UNLABELLED_ANALYSIS_STATUSES;
  return statuses.length > 0 && statuses.every((s) => unlabelled.includes(s));
}
