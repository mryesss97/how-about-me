import {
  ConfidenceBandsSchema,
  SafetyThresholdsSchema,
  type UpdateAnalysisSettingsBody,
} from "@how-about-me/contracts";
import {
  DEFAULT_ANALYSIS_POLICY,
  SAFETY_CATEGORIES,
  type AnalysisPolicy,
  type SafetyThreshold,
} from "@how-about-me/taxonomy";

/** Minimal stored shape of one `analysis_settings` row needed to rebuild a policy. */
export type StoredPolicyRow = {
  version: number;
  policyVersion: string;
  confidenceBands: unknown;
  safetyThresholds: unknown;
};

export type PolicyChange = { from: number | null; to: number | null };

/**
 * Row → policy (FR-190). No row → v1 defaults (BR-018, BR-021). Stored JSON is re-validated with the
 * contract schemas; a corrupt row throws rather than silently analysing with wrong thresholds.
 */
export function toAnalysisPolicy(row: StoredPolicyRow | null): AnalysisPolicy {
  if (!row) return DEFAULT_ANALYSIS_POLICY;
  return {
    version: row.version,
    policyVersion: row.policyVersion,
    confidenceBands: ConfidenceBandsSchema.parse(row.confidenceBands),
    safetyThresholds: SafetyThresholdsSchema.parse(row.safetyThresholds),
  };
}

/** Applies a PATCH body onto the active policy (thresholds are a per-category patch). Not validated here. */
export function mergePolicy(
  current: AnalysisPolicy,
  body: UpdateAnalysisSettingsBody,
): Pick<AnalysisPolicy, "confidenceBands" | "safetyThresholds"> {
  const thresholds: Record<string, SafetyThreshold> = { ...current.safetyThresholds };
  for (const [category, t] of Object.entries(body.safetyThresholds ?? {})) {
    if (t) thresholds[category] = { sensitive: t.sensitive, severe: t.severe };
  }
  return {
    confidenceBands: body.confidenceBands ? { ...body.confidenceBands } : { ...current.confidenceBands },
    safetyThresholds: thresholds as AnalysisPolicy["safetyThresholds"],
  };
}

/**
 * Flat diff for the audit `changes` metadata (FR-200): `confidenceBands.<band>` and
 * `safetyThresholds.<category>.<level>`. Empty object = no-op.
 */
export function diffPolicy(
  a: Pick<AnalysisPolicy, "confidenceBands" | "safetyThresholds">,
  b: Pick<AnalysisPolicy, "confidenceBands" | "safetyThresholds">,
): Record<string, PolicyChange> {
  const changes: Record<string, PolicyChange> = {};
  for (const band of ["high", "medium"] as const) {
    if (a.confidenceBands[band] !== b.confidenceBands[band]) {
      changes[`confidenceBands.${band}`] = { from: a.confidenceBands[band], to: b.confidenceBands[band] };
    }
  }
  for (const category of SAFETY_CATEGORIES) {
    for (const level of ["sensitive", "severe"] as const) {
      const from = a.safetyThresholds[category][level];
      const to = b.safetyThresholds[category][level];
      if (from !== to) changes[`safetyThresholds.${category}.${level}`] = { from, to };
    }
  }
  return changes;
}
