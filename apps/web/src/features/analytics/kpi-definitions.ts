/**
 * KPI tooltip copy, taken from docs/01-product/07-metric-definitions.md §1.1–1.6 (FR-140, TC-DASH-006).
 * Sentiment and safety are separate cards on purpose (BR-017).
 */
export type KpiId = "mentions" | "growth" | "positive" | "negative" | "safety" | "complaint";

export type KpiDefinition = { id: KpiId; label: string; definition: string; denominator: string };

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    id: "mentions",
    label: "Total Relevant Mentions",
    definition: "Distinct posts in range matching the current filters.",
    denominator: "distinct posts published in range with relevance = relevant",
  },
  {
    id: "growth",
    label: "Mention Growth",
    definition:
      "(current − previous) / previous over the previous equal-length window. Shows New when the previous period had 0 mentions.",
    denominator: "mentions in the previous equal-length period",
  },
  {
    id: "positive",
    label: "Positive Rate",
    definition: "Share of analysed mentions with sentiment = positive.",
    denominator: "relevant mentions with a completed sentiment label",
  },
  {
    id: "negative",
    label: "Negative Rate",
    definition: "Share of analysed mentions with sentiment = negative.",
    denominator: "relevant mentions with a completed sentiment label",
  },
  {
    id: "safety",
    label: "Sensitive + Severe Rate",
    definition: "Share of mentions with safety level sensitive or severe. Severe count shown separately when > 0.",
    denominator: "relevant mentions with a completed safety level",
  },
  {
    id: "complaint",
    label: "Complaint Rate",
    definition: "Share of mentions whose intents include complaint.",
    denominator: "relevant mentions with at least one intent label",
  },
];

export function kpiDefinition(id: KpiId): KpiDefinition {
  const def = KPI_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown KPI ${id}`);
  return def;
}
