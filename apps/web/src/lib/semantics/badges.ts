import type { AnalysisStatus } from "@how-about-me/contracts";
import type { ConfidenceBand, RelevanceLabel, SafetyLevel, SentimentLabel } from "@how-about-me/taxonomy";

/**
 * Semantic badge mapping — docs/01-product/09-ux-specification.md §2.2.
 * Colour is never the only encoding: every entry carries a label and an icon name (from @untitledui/icons).
 */
export type BadgeColor = "gray" | "brand" | "error" | "warning" | "success" | "blue";
export type BadgeSpec = { label: string; color: BadgeColor; icon: string; filled?: boolean };

export const sentimentBadge: Record<SentimentLabel, BadgeSpec> = {
  positive: { label: "Tích cực", color: "success", icon: "FaceSmile" },
  neutral: { label: "Trung tính", color: "gray", icon: "FaceNeutral" },
  negative: { label: "Tiêu cực", color: "error", icon: "FaceFrown" },
};

export const safetyBadge: Record<SafetyLevel, BadgeSpec> = {
  safe: { label: "An toàn", color: "gray", icon: "ShieldTick" },
  sensitive: { label: "Nhạy cảm", color: "warning", icon: "AlertTriangle" },
  severe: { label: "Nghiêm trọng", color: "error", icon: "AlertOctagon", filled: true },
};

export const relevanceBadge: Record<RelevanceLabel, BadgeSpec> = {
  relevant: { label: "Liên quan", color: "brand", icon: "Target04" },
  uncertain: { label: "Chưa chắc", color: "warning", icon: "HelpCircle" },
  irrelevant: { label: "Không liên quan", color: "gray", icon: "MinusCircle" },
};

export const analysisStatusBadge: Record<AnalysisStatus, BadgeSpec> = {
  pending: { label: "Chờ phân tích", color: "gray", icon: "Clock" },
  processing: { label: "Đang phân tích…", color: "blue", icon: "Loading02" },
  completed: { label: "Đã phân tích", color: "success", icon: "CheckCircle" },
  failed: { label: "Phân tích lỗi", color: "error", icon: "XCircle" },
  skipped: { label: "Bỏ qua", color: "gray", icon: "MinusCircle" },
  stale: { label: "Cũ", color: "warning", icon: "RefreshCw05" },
};

export const confidenceMarker: Record<ConfidenceBand, { label: string; short: string; show: boolean }> = {
  high: { label: "Độ tin cậy cao", short: "", show: false },
  medium: { label: "Độ tin cậy trung bình", short: "≈", show: true },
  low: { label: "Độ tin cậy thấp", short: "Tin cậy thấp", show: true },
};

/** Formats a KPI value; `null` denominators render as "—", `growthState=new` renders "New" (BR-030). */
export function formatRate(value: number | null, digits = 1): string {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}
