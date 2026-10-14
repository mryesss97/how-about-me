import { z } from "zod";
import { IsoDateTimeSchema, withDateRange } from "./common.js";
import { AnalysisFiltersBaseSchema } from "./filters.js";

/** FR-149 (#261): default range of `GET …/analytics/landing-terms` when `from`/`to` are omitted — rolling 30 days. */
export const LANDING_DEFAULT_RANGE_DAYS = 30;

/** `GET …/analytics/landing-terms` (FR-149): shared filters, no `compare`. */
export const LandingTermsQuerySchema = withDateRange(AnalysisFiltersBaseSchema);
export type LandingTermsQuery = z.infer<typeof LandingTermsQuerySchema>;

export const LandingSentimentSchema = z.enum(["positive", "neutral", "negative"]);

/**
 * FR-149, BR-042 — metric-definitions §4 "Landing terms × sentiment". One row per configured `landingTerms` in
 * setting order; DISTINCT posts per effective sentiment (BR-025). `dominant`/`dominantShare` null when total = 0;
 * tie-break negative > positive > neutral. Rows overlap (a post may match several terms) — do not sum them.
 */
export const LandingTermsResponseSchema = z.object({
  range: z.object({ from: IsoDateTimeSchema, to: IsoDateTimeSchema, timezone: z.string() }),
  sentimentAnalyzed: z.number().int(),
  rows: z.array(
    z.object({
      term: z.string(),
      positive: z.number().int(),
      neutral: z.number().int(),
      negative: z.number().int(),
      total: z.number().int(),
      dominant: LandingSentimentSchema.nullable(),
      dominantShare: z.number().min(0).max(1).nullable(),
    }),
  ),
});
export type LandingTermsResponse = z.infer<typeof LandingTermsResponseSchema>;
export type LandingTermRow = LandingTermsResponse["rows"][number];
