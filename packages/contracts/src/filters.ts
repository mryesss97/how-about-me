import { z } from "zod";
import { csvArray, IanaTimezoneSchema, IsoDateTimeSchema, queryBoolean, UuidSchema, withDateRange } from "./common.js";
import {
  AnalysisStatusSchema,
  IntentLabelSchema,
  LanguageCodeSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
  TopicLabelSchema,
} from "./enums.js";

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
