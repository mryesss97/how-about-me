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

/** Shared analytics/mentions filters — docs/02-architecture/05-api-contract.md §6–§7. Default relevance = relevant (BR-016).
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

/** Default minimum DISTINCT posts for a phrase row (FR-148, configurable per request via `minMentions`). */
export const DEFAULT_PHRASE_MIN_MENTIONS = 2;
export const DEFAULT_PHRASE_LIMIT = 30;

/** `GET …/analytics/phrases` (FR-148): shared filters + top-N `limit` and `minMentions` threshold. `compare` ignored. */
export const PhrasesQuerySchema = withDateRange(
  AnalyticsQueryBaseSchema.extend({
    limit: queryInt(1, 100).default(DEFAULT_PHRASE_LIMIT),
    minMentions: queryInt(1, 1000).default(DEFAULT_PHRASE_MIN_MENTIONS),
  }),
);
export type PhrasesQuery = z.infer<typeof PhrasesQuerySchema>;
