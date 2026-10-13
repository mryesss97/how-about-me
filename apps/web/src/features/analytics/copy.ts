import type { SentimentLabel } from "@how-about-me/taxonomy";
import { formatCount, formatRate } from "@/lib/format/number";

/**
 * UI copy for the sentiment bubble map (#222). English for MVP (docs 03 §8); Vietnamese labels from the brand
 * guide v2 prototype are kept next to each string so VI can be switched on later.
 */
export const bubbleMapCopy = {
  title: "Sentiment map", // "Bản đồ cảm xúc"
  description: "Topics in analysed mentions",
  viewChart: "Bubbles", // "Bong bóng"
  viewTable: "Table", // "Bảng dữ liệu"
  filterLabel: "Filter by dominant sentiment",
  filterAll: "All", // "Tất cả" · "Tiêu cực" · "Tích cực" · "Trung tính"
  canvasLabel: "Sentiment map bubbles",
  empty: "No analysed mentions in this range",
  emptyFiltered: (s: SentimentLabel) => `No topics where ${s} is dominant.`,
  legend: "Area = mentions with sentiment · Intensity = share of the dominant sentiment", // "Diện tích = số bài viết · Độ đậm = tỷ lệ cảm xúc chủ đạo"
  topicCount: (n: number) => `${formatCount(n)} ${n === 1 ? "topic" : "topics"}`, // "N cụm từ"
  mentions: (n: number) => `${formatCount(n)} ${n === 1 ? "mention" : "mentions"}`, // "đề cập"
  shareLine: (share: number, s: SentimentLabel) => `${formatRate(share)} ${s}`,
  hint: "Select a bubble to see its sentiment breakdown.",
  withSentiment: (n: number) => `${formatCount(n)} ${n === 1 ? "mention" : "mentions"} with sentiment`,
  viewAll: (n: number) => `View all ${formatCount(n)} ${n === 1 ? "mention" : "mentions"}`,
  tableColumns: ["Topic", "Dominant sentiment", "Dominant share", "Positive", "Neutral", "Negative", "With sentiment"],
} as const;
