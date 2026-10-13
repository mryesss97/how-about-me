import { SAFETY_CATEGORIES, type SafetyCategory } from "@how-about-me/taxonomy";
import { z } from "zod";
import { IsoDateTimeSchema, UuidSchema } from "./common.js";
import { AnalysisVersionsSchema } from "./mentions.js";

/** Threshold/band value: step 0.01 in [0.01, 1]; 0 would trigger on every post (FR-190). */
export const PolicyProbabilitySchema = z.number().min(0.01).max(1).multipleOf(0.01);

/** BR-021: `medium` must be strictly below `high`. */
export const ConfidenceBandsSchema = z
  .object({ high: PolicyProbabilitySchema, medium: PolicyProbabilitySchema })
  .strict()
  .refine((b) => b.medium < b.high, { message: "medium must be lower than high", path: ["medium"] });
export type ConfidenceBandsDto = z.infer<typeof ConfidenceBandsSchema>;

/** BR-018: at least one level set; when both are set, `sensitive < severe`. */
export const SafetyThresholdSchema = z
  .object({ sensitive: PolicyProbabilitySchema.nullable(), severe: PolicyProbabilitySchema.nullable() })
  .strict()
  .refine((t) => t.sensitive !== null || t.severe !== null, { message: "sensitive and severe cannot both be null" })
  .refine((t) => t.sensitive === null || t.severe === null || t.sensitive < t.severe, {
    message: "sensitive must be lower than severe",
    path: ["sensitive"],
  });

function byCategory<T extends z.ZodType>(item: T) {
  return Object.fromEntries(SAFETY_CATEGORIES.map((c) => [c, item])) as Record<SafetyCategory, T>;
}

/** Full thresholds table — every category of `SAFETY_CATEGORIES`, no unknown keys. */
export const SafetyThresholdsSchema = z.object(byCategory(SafetyThresholdSchema)).strict();
export type SafetyThresholdsDto = z.infer<typeof SafetyThresholdsSchema>;

/**
 * PATCH /projects/:projectId/settings/analysis (FR-190, admin only). Thresholds are a per-category patch;
 * the server merges into the active policy and re-validates the merged table.
 */
export const UpdateAnalysisSettingsBodySchema = z
  .object({
    confidenceBands: ConfidenceBandsSchema.optional(),
    safetyThresholds: z.object(byCategory(SafetyThresholdSchema.optional())).strict().optional(),
  })
  .strict()
  .refine(
    (b) => b.confidenceBands !== undefined || (b.safetyThresholds && Object.keys(b.safetyThresholds).length > 0),
    {
      message: "At least one setting must be provided",
    },
  );
export type UpdateAnalysisSettingsBody = z.infer<typeof UpdateAnalysisSettingsBodySchema>;

/** GET/PATCH response — active policy of the project plus current version info (FR-190, BR-023). */
export const AnalysisSettingsSchema = z.object({
  policyVersion: z.string(),
  version: z.number().int().min(1),
  isDefault: z.boolean(),
  confidenceBands: ConfidenceBandsSchema,
  safetyThresholds: SafetyThresholdsSchema,
  versions: AnalysisVersionsSchema,
  effectiveVersion: z.string(),
  /** Posts whose current analysis was made with another policy version (candidates for re-analysis). */
  outdatedCount: z.number().int().min(0),
  createdAt: IsoDateTimeSchema.nullable(),
  createdBy: z.object({ id: UuidSchema, displayName: z.string().nullable(), email: z.string() }).nullable(),
});
export type AnalysisSettings = z.infer<typeof AnalysisSettingsSchema>;
