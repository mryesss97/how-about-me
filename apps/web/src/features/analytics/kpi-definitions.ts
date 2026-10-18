/**
 * KPI tooltip copy, taken from docs/01-product/07-metric-definitions.md §1.1–1.6 (FR-140, TC-DASH-006).
 * Sentiment and safety are separate cards on purpose (BR-017).
 */
export type KpiId = "mentions" | "growth" | "positive" | "negative" | "safety" | "complaint";

/** `denominatorNoun`: short noun for the card sub-line "trên N …" — each rate names its own denominator (#335). */
export type KpiDefinition = {
  id: KpiId;
  label: string;
  definition: string;
  denominator: string;
  denominatorNoun?: string;
};

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    id: "mentions",
    label: "Tổng lượt nhắc liên quan",
    definition: "Số bài nhắc (không trùng) trong khoảng thời gian, khớp bộ lọc hiện tại.",
    denominator: "bài nhắc (không trùng) đăng trong khoảng thời gian có mức liên quan = liên quan",
  },
  {
    id: "growth",
    label: "Tăng trưởng lượt nhắc",
    definition:
      "(kỳ này − kỳ trước) / kỳ trước, so với kỳ liền trước cùng độ dài. Hiện “Mới” khi kỳ trước có 0 lượt nhắc.",
    denominator: "lượt nhắc trong kỳ liền trước cùng độ dài",
  },
  {
    id: "positive",
    denominatorNoun: "đã phân tích",
    label: "Tỷ lệ tích cực",
    definition: "Tỷ lệ lượt nhắc đã phân tích có cảm xúc = tích cực.",
    denominator: "lượt nhắc liên quan đã có nhãn cảm xúc",
  },
  {
    id: "negative",
    denominatorNoun: "đã phân tích",
    label: "Tỷ lệ tiêu cực",
    definition: "Tỷ lệ lượt nhắc đã phân tích có cảm xúc = tiêu cực.",
    denominator: "lượt nhắc liên quan đã có nhãn cảm xúc",
  },
  {
    id: "safety",
    denominatorNoun: "có mức an toàn",
    label: "Tỷ lệ nhạy cảm + nghiêm trọng",
    definition: "Tỷ lệ lượt nhắc có mức an toàn là nhạy cảm hoặc nghiêm trọng. Số nghiêm trọng hiện riêng khi > 0.",
    denominator: "lượt nhắc liên quan đã có mức an toàn",
  },
  {
    id: "complaint",
    denominatorNoun: "có ý định",
    label: "Tỷ lệ phàn nàn",
    definition: "Tỷ lệ lượt nhắc có ý định gồm phàn nàn.",
    denominator: "lượt nhắc liên quan có ít nhất một nhãn ý định",
  },
];

export function kpiDefinition(id: KpiId): KpiDefinition {
  const def = KPI_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown KPI ${id}`);
  return def;
}
