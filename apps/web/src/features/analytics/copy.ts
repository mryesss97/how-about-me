import type { SentimentLabel } from "@how-about-me/taxonomy";
import { type Filters, rangeLabel } from "@/lib/filters";
import { formatCount } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { bubbleCopy } from "@/features/shared/bubbles/sentiment-style";

const sentimentWord = (s: SentimentLabel) => sentimentBadge[s].label.toLowerCase();

/** UI copy for the sentiment bubble map (#222), Vietnamese since #275. */
export const bubbleMapCopy = {
  title: "Bản đồ cảm xúc",
  description: "Chủ đề trong các lượt nhắc đã phân tích",
  viewChart: "Bong bóng",
  viewTable: "Bảng dữ liệu",
  filterLabel: "Lọc theo cảm xúc chủ đạo",
  filterAll: "Tất cả",
  canvasLabel: "Bong bóng bản đồ cảm xúc",
  empty: "Chưa có lượt nhắc đã phân tích trong khoảng này",
  emptyFiltered: (s: SentimentLabel) => `Không có chủ đề nào mà cảm xúc ${sentimentWord(s)} chiếm ưu thế.`,
  legend: "Diện tích = lượt nhắc có cảm xúc · Độ đậm = tỷ lệ cảm xúc chủ đạo",
  topicCount: (n: number) => `${formatCount(n)} chủ đề`,
  mentions: bubbleCopy.mentions,
  shareLine: bubbleCopy.shareLine,
  hint: "Chọn một bong bóng để xem chi tiết cảm xúc.",
  withSentiment: (n: number) => `${formatCount(n)} lượt nhắc có cảm xúc`,
  viewAll: (n: number) => `Xem tất cả ${formatCount(n)} lượt nhắc`,
  // #243 Topics | Phrases toggle (FR-148).
  modeLabel: "Nhóm bong bóng theo",
  modeTopics: "Chủ đề",
  modePhrases: "Cụm từ",
  descriptionPhrases: "Cụm từ chính trong các lượt nhắc đã phân tích",
  emptyFilteredPhrases: (s: SentimentLabel) => `Không có cụm từ nào mà cảm xúc ${sentimentWord(s)} chiếm ưu thế.`,
  phraseCount: (n: number) => `${formatCount(n)} cụm từ`,
  phraseTop: (shown: number, total: number) => `Top ${formatCount(shown)} trên ${formatCount(total)} cụm từ`,
  emptyPhrases: "Chưa có cụm từ — hãy phân tích lại để trích xuất cụm từ",
  emptyPhrasesDescription:
    "Các lượt nhắc được phân tích trước khi có tính năng trích cụm từ sẽ chưa có cụm từ cho tới khi được phân tích lại.",
  emptyPhrasesThreshold: (n: number) => `Không có cụm từ nào đạt ${formatCount(n)} lượt nhắc`,
  emptyPhrasesThresholdDescription: "Hãy mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc.",
  phraseTableColumns: [
    "Cụm từ",
    "Cảm xúc chủ đạo",
    "Tỷ lệ chủ đạo",
    "Tích cực",
    "Trung tính",
    "Tiêu cực",
    "Có cảm xúc",
  ],
  tableColumns: ["Chủ đề", "Cảm xúc chủ đạo", "Tỷ lệ chủ đạo", "Tích cực", "Trung tính", "Tiêu cực", "Có cảm xúc"],
} as const;

/** Phrase detail page `/terms/[term]` (#276). */
export const termDetailCopy = {
  back: "Về bức tường cụm từ",
  allMentions: "Xem tất cả trong Bài nhắc",
  withSentiment: (n: string) => `${n} lượt nhắc có cảm xúc`,
  /** Hero period (#332): relative presets as words, custom as its dates. */
  period: (filters: Filters, now?: Date) => PERIOD[filters.preset] ?? rangeLabel(filters, now).replace(" – ", "–"),
  none: "Chưa ai nhắc tới cụm từ này trong khoảng thời gian đã chọn.",
  splitLabel: "Tỷ lệ cảm xúc",
  sentiment: { positive: "Tích cực", neutral: "Trung tính", negative: "Tiêu cực" },
  matchNote: "Đếm các bài có nội dung hoặc cụm từ khoá chứa cụm này (BR-042), giống biển ở trang chủ.",
} as const;

const PERIOD: Record<string, string | undefined> = {
  "1h": "1 GIỜ QUA",
  "24h": "24 GIỜ QUA",
  "7d": "7 NGÀY QUA",
  "30d": "30 NGÀY QUA",
};
