import { z } from "zod";
import { IsoDateTimeSchema } from "./common.js";
import { IntegrationStatusSchema, JobStatusSchema } from "./enums.js";

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
