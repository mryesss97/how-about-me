import type { AnalysisStatus } from "@how-about-me/contracts";
import type { ConfidenceBand, RelevanceLabel, SafetyLevel, SentimentLabel } from "@how-about-me/taxonomy";

/**
 * Semantic badge mapping — docs/01-product/09-ux-specification.md §2.2.
 * Colour is never the only encoding: every entry carries a label and an icon name (from @untitledui/icons).
 */
export type BadgeColor = "gray" | "brand" | "error" | "warning" | "success" | "blue";
export type BadgeSpec = { label: string; color: BadgeColor; icon: string; filled?: boolean };

export const sentimentBadge: Record<SentimentLabel, BadgeSpec> = {
  positive: { label: "Positive", color: "success", icon: "FaceSmile" },
  neutral: { label: "Neutral", color: "gray", icon: "FaceNeutral" },
  negative: { label: "Negative", color: "error", icon: "FaceFrown" },
};

export const safetyBadge: Record<SafetyLevel, BadgeSpec> = {
  safe: { label: "Safe", color: "gray", icon: "ShieldTick" },
  sensitive: { label: "Sensitive", color: "warning", icon: "AlertTriangle" },
  severe: { label: "Severe", color: "error", icon: "AlertOctagon", filled: true },
};

export const relevanceBadge: Record<RelevanceLabel, BadgeSpec> = {
  relevant: { label: "Relevant", color: "brand", icon: "Target04" },
  uncertain: { label: "Uncertain", color: "warning", icon: "HelpCircle" },
  irrelevant: { label: "Irrelevant", color: "gray", icon: "MinusCircle" },
};

export const analysisStatusBadge: Record<AnalysisStatus, BadgeSpec> = {
  pending: { label: "Pending analysis", color: "gray", icon: "Clock" },
  processing: { label: "Analysing…", color: "blue", icon: "Loading02" },
  completed: { label: "Analysed", color: "success", icon: "CheckCircle" },
  failed: { label: "Analysis failed", color: "error", icon: "XCircle" },
  skipped: { label: "Skipped", color: "gray", icon: "MinusCircle" },
  stale: { label: "Stale", color: "warning", icon: "RefreshCw05" },
};

export const confidenceMarker: Record<ConfidenceBand, { label: string; show: boolean }> = {
  high: { label: "High confidence", show: false },
  medium: { label: "Medium confidence", show: true },
  low: { label: "Low confidence", show: true },
};

/** Formats a KPI value; `null` denominators render as "—", `growthState=new` renders "New" (BR-030). */
export function formatRate(value: number | null, digits = 1): string {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}
export function formatGrowth(growthPct: number | null, state: "up" | "down" | "flat" | "new"): string {
  if (state === "new" || growthPct == null) return "New";
  const sign = growthPct > 0 ? "+" : "";
  return `${sign}${growthPct.toFixed(1)}%`;
}
