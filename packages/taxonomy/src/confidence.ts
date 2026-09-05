/** Confidence bands v1 (BR-021). Values are estimated model confidence, not calibrated probability (BR-020). */
export const CONFIDENCE_BANDS = { high: 0.8, medium: 0.6 } as const;
export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(
  confidence: number,
  bands: { high: number; medium: number } = CONFIDENCE_BANDS,
): ConfidenceBand {
  if (confidence >= bands.high) return "high";
  if (confidence >= bands.medium) return "medium";
  return "low";
}

/** Overall confidence used for list sorting = min(relevance, sentiment) — doc 08 §8. */
export function overallConfidence(relevance: number, sentiment: number | null | undefined): number {
  return sentiment == null ? relevance : Math.min(relevance, sentiment);
}
