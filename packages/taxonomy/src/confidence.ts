import type { RelevanceLabel } from "./labels.js";

/** Confidence bands v1 (BR-021). Values are estimated model confidence, not calibrated probability (BR-020). */
export const CONFIDENCE_BANDS = { high: 0.8, medium: 0.6 } as const;
/** Band lower bounds; v1 defaults above, configurable per project from analysis_settings (FR-190, BR-021). */
export type ConfidenceBands = { high: number; medium: number };
export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number, bands: ConfidenceBands = CONFIDENCE_BANDS): ConfidenceBand {
  if (confidence >= bands.high) return "high";
  if (confidence >= bands.medium) return "medium";
  return "low";
}

/** Overall confidence used for list sorting = min(relevance, sentiment) — doc 08 §8. */
export function overallConfidence(relevance: number, sentiment: number | null | undefined): number {
  return sentiment == null ? relevance : Math.min(relevance, sentiment);
}

/** Low-confidence relevance is treated as `uncertain` (doc 08 §8, BR-021). Pure; reused by the analysis pipeline. */
export function effectiveRelevance(
  label: RelevanceLabel,
  confidence: number,
  bands: ConfidenceBands = CONFIDENCE_BANDS,
): RelevanceLabel {
  return confidenceBand(confidence, bands) === "low" ? "uncertain" : label;
}
