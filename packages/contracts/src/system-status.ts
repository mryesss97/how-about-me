import { z } from "zod";
import { IsoDateTimeSchema } from "./common.js";
import { IntegrationStatusSchema } from "./enums.js";
import { AnalysisVersionsSchema } from "./mentions.js";

export const SystemStatusResponseSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  threads: z.object({
    status: IntegrationStatusSchema,
    accountIdentifier: z.string().nullable(),
    tokenExpiresAt: IsoDateTimeSchema.nullable(),
    lastSuccessAt: IsoDateTimeSchema.nullable(),
    lastError: z.object({ code: z.string(), message: z.string(), at: IsoDateTimeSchema }).nullable(),
  }),
  collector: z.object({
    status: z.enum(["healthy", "degraded", "paused"]),
    activeQueries: z.number().int(),
    lastGlobalSyncAt: IsoDateTimeSchema.nullable(),
    jobsInProgress: z.number().int(),
    failedJobs24h: z.number().int(),
    partialJobs24h: z.number().int(),
    successRate24h: z.number().min(0).max(1).nullable(),
    collectionLagSeconds: z.number().int().nullable(),
    circuit: z.object({ open: z.boolean(), until: IsoDateTimeSchema.nullable(), reason: z.string().nullable() }),
  }),
  analysis: z.object({
    status: z.enum(["healthy", "degraded", "budget_paused"]),
    pending: z.number().int(),
    processing: z.number().int(),
    failed24h: z.number().int(),
    completed24h: z.number().int(),
    analysisLagSeconds: z.number().int(),
    versions: AnalysisVersionsSchema,
    tokens24h: z.object({ input: z.number().int(), output: z.number().int() }),
    estimatedCost24hUsd: z.number(),
  }),
  database: z.object({
    approxPosts: z.number().int(),
    approxAnalyses: z.number().int(),
    lastMigration: z.string().nullable(),
  }),
});
export type SystemStatusResponse = z.infer<typeof SystemStatusResponseSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  checks: z.record(z.string(), z.enum(["up", "down", "unknown"])).optional(),
  version: z.string().optional(),
});
