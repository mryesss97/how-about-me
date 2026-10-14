import type { AnalysisTrigger } from "@how-about-me/contracts";
import type { IntentLabel, LanguageCode, TopicLabel } from "@how-about-me/taxonomy";
import { analysisStatusBadge, relevanceBadge, safetyBadge, sentimentBadge } from "./badges";

/**
 * Vietnamese display labels for taxonomy enums (#275). Enum values (URL params, API) stay English;
 * only what the user reads is translated. Unknown values fall back to a humanised form.
 */
export const intentLabelVi: Record<IntentLabel, string> = {
  praise: "Khen ngợi",
  complaint: "Phàn nàn",
  question: "Câu hỏi",
  recommendation: "Gợi ý",
  purchase_intent: "Ý định mua",
  boycott: "Tẩy chay",
  spam: "Spam",
  information: "Thông tin",
  support_request: "Yêu cầu hỗ trợ",
  comparison: "So sánh",
  other: "Khác",
};

export const topicLabelVi: Record<TopicLabel, string> = {
  artist: "Nghệ sĩ",
  ticket: "Vé",
  venue: "Địa điểm",
  price: "Giá",
  performance: "Biểu diễn",
  membership: "Hội viên",
  payment: "Thanh toán",
  queue: "Xếp hàng",
  customer_service: "CSKH",
  event: "Sự kiện",
  merchandise: "Hàng lưu niệm",
  other: "Khác",
};

export const languageLabelVi: Record<LanguageCode, string> = {
  vi: "Tiếng Việt",
  en: "Tiếng Anh",
  ko: "Tiếng Hàn",
  ja: "Tiếng Nhật",
  th: "Tiếng Thái",
  zh: "Tiếng Trung",
  other: "Khác",
  unknown: "Không xác định",
};

/** Analysis run trigger (#277, Mention detail → History). */
export const analysisTriggerLabelVi: Record<AnalysisTrigger, string> = {
  ingest: "Thu thập",
  content_change: "Nội dung thay đổi",
  manual: "Thủ công",
  bulk: "Hàng loạt",
  retry: "Thử lại",
  version_change: "Đổi phiên bản",
};

export type LabelKind =
  "intent" | "topic" | "language" | "sentiment" | "safety" | "relevance" | "analysisStatus" | "analysisTrigger";

/** `customer_service` → "Customer service" — fallback for values outside the taxonomy. */
export const humanizeLabel = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ");

const TABLES: Record<LabelKind, Record<string, string>> = {
  intent: intentLabelVi,
  topic: topicLabelVi,
  language: languageLabelVi,
  sentiment: Object.fromEntries(Object.entries(sentimentBadge).map(([k, v]) => [k, v.label])),
  safety: Object.fromEntries(Object.entries(safetyBadge).map(([k, v]) => [k, v.label])),
  relevance: Object.fromEntries(Object.entries(relevanceBadge).map(([k, v]) => [k, v.label])),
  analysisStatus: Object.fromEntries(Object.entries(analysisStatusBadge).map(([k, v]) => [k, v.label])),
  analysisTrigger: analysisTriggerLabelVi,
};

export function displayLabel(kind: LabelKind, value: string): string {
  return TABLES[kind][value] ?? humanizeLabel(value);
}
