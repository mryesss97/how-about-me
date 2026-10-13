import { z } from "zod";
import { IsoDateTimeSchema } from "./common.js";
import {
  IntegrationStatusSchema,
  IntentLabelSchema,
  JobStatusSchema,
  LanguageCodeSchema,
  SafetyLevelSchema,
  TopicLabelSchema,
} from "./enums.js";

const Rate = z.object({
  value: z.number().min(0).max(1).nullable(),
  numerator: z.number().int(),
  denominator: z.number().int(),
  previous: z.number().nullable().optional(),
});

export const OverviewResponseSchema = z.object({
  meta: z.object({ metricsVersion: z.string(), generatedAt: IsoDateTimeSchema }),
  range: z.object({
    from: IsoDateTimeSchema,
    to: IsoDateTimeSchema,
    timezone: z.string(),
    previous: z.object({ from: IsoDateTimeSchema, to: IsoDateTimeSchema }).optional(),
  }),
  coverage: z.object({
    relevantMentions: z.number().int(),
    analyzedMentions: z.number().int(),
    pendingMentions: z.number().int(),
    failedMentions: z.number().int(),
    irrelevantMentions: z.number().int(),
    uncertainMentions: z.number().int(),
  }),
  dataQuality: z.object({
    lastSyncStatus: JobStatusSchema.or(z.literal("none")),
    lastSyncAt: IsoDateTimeSchema.nullable(),
    integrationStatus: IntegrationStatusSchema,
    collectorStatus: z.enum(["healthy", "degraded", "paused"]),
  }),
  kpis: z.object({
    mentionCount: z.object({
      value: z.number().int(),
      previous: z.number().int().nullable(),
      growthPct: z.number().nullable(),
      growthState: z.enum(["up", "down", "flat", "new"]),
    }),
    positiveRate: Rate,
    negativeRate: Rate,
    safetyRiskRate: Rate.extend({ severeCount: z.number().int() }),
    complaintRate: Rate,
  }),
});
export type OverviewResponse = z.infer<typeof OverviewResponseSchema>;

export const TimeseriesPointSchema = z.object({
  time: IsoDateTimeSchema,
  mentions: z.number().int(),
  previous: z.number().int().optional(),
});
export const TimeseriesResponseSchema = z.object({
  interval: z.enum(["hour", "day"]),
  timezone: z.string(),
  data: z.array(TimeseriesPointSchema),
});
export type TimeseriesResponse = z.infer<typeof TimeseriesResponseSchema>;

export const DistributionItemSchema = z.object({
  label: z.string(),
  count: z.number().int(),
  share: z.number().min(0).max(1).nullable(),
});
export const DistributionResponseSchema = z.object({
  denominator: z.number().int(),
  distribution: z.array(DistributionItemSchema),
});
export type DistributionResponse = z.infer<typeof DistributionResponseSchema>;

export const SentimentResponseSchema = DistributionResponseSchema.extend({
  timeseries: z
    .object({
      interval: z.enum(["hour", "day"]),
      data: z.array(
        z.object({
          time: IsoDateTimeSchema,
          positive: z.number().int(),
          neutral: z.number().int(),
          negative: z.number().int(),
        }),
      ),
    })
    .optional(),
});
export type SentimentResponse = z.infer<typeof SentimentResponseSchema>;

const typedDistribution = <T extends z.ZodTypeAny>(label: T) =>
  z.object({
    denominator: z.number().int(),
    distribution: z.array(DistributionItemSchema.extend({ label })),
  });
const TopicOrOther = z.union([TopicLabelSchema, z.literal("other")]);

export const SafetyDistributionResponseSchema = typedDistribution(SafetyLevelSchema);
export const IntentsDistributionResponseSchema = typedDistribution(IntentLabelSchema);
/** Top 12 topics + "other" bucket. */
export const TopicsDistributionResponseSchema = typedDistribution(TopicOrOther);
/** P1 — GET …/analytics/languages (FR-143): all 8 codes, count desc; unknown codes are folded into "other". */
export const LanguagesDistributionResponseSchema = typedDistribution(LanguageCodeSchema);
export type LanguagesDistributionResponse = z.infer<typeof LanguagesDistributionResponseSchema>;
export type SafetyDistributionResponse = z.infer<typeof SafetyDistributionResponseSchema>;
export type IntentsDistributionResponse = z.infer<typeof IntentsDistributionResponseSchema>;
export type TopicsDistributionResponse = z.infer<typeof TopicsDistributionResponseSchema>;

/** P1 — GET …/analytics/topic-sentiment. */
export const TopicSentimentResponseSchema = z.object({
  rows: z.array(
    z.object({
      topic: TopicOrOther,
      positive: z.number().int(),
      neutral: z.number().int(),
      negative: z.number().int(),
      total: z.number().int(),
      negativeShare: z.number().min(0).max(1).nullable(),
    }),
  ),
});
export type TopicSentimentResponse = z.infer<typeof TopicSentimentResponseSchema>;

/** P1 — GET …/analytics/query-share. Shares overlap (one post may match several queries). */
export const QueryShareResponseSchema = z.object({
  denominator: z.number().int(),
  distribution: z.array(
    z.object({
      queryId: z.uuid(),
      displayName: z.string(),
      count: z.number().int(),
      share: z.number().min(0).max(1).nullable(),
    }),
  ),
  note: z.literal("overlapping"),
});
export type QueryShareResponse = z.infer<typeof QueryShareResponseSchema>;
