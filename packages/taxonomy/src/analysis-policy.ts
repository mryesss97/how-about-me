import { CONFIDENCE_BANDS, type ConfidenceBands } from "./confidence.js";
import { SAFETY_POLICY_V1, type SafetyCategory, type SafetyThreshold } from "./safety-policy.js";
import { SAFETY_POLICY_VERSION } from "./versions.js";

/**
 * One immutable analysis policy version of a project (FR-190): confidence bands (BR-021) + safety thresholds (BR-018).
 * Bands and thresholds share a single `safety-policy-v{n}` version so the BR-023 key changes whenever results can.
 */
export type AnalysisPolicy = {
  version: number;
  policyVersion: string;
  confidenceBands: ConfidenceBands;
  safetyThresholds: Readonly<Record<SafetyCategory, SafetyThreshold>>;
};

/** v1 defaults, used by every project that has no `analysis_settings` row (doc 08 §8–§10). */
export const DEFAULT_ANALYSIS_POLICY: AnalysisPolicy = Object.freeze({
  version: 1,
  policyVersion: SAFETY_POLICY_VERSION,
  confidenceBands: { ...CONFIDENCE_BANDS },
  safetyThresholds: SAFETY_POLICY_V1,
});
