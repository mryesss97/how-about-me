import type { SentimentLabel } from "@how-about-me/taxonomy";
import { type Filters, rangeLabel } from "@/lib/filters";
import { formatCount } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { bubbleCopy } from "@/features/shared/bubbles/sentiment-style";

const sentimentWord = (s: SentimentLabel) => sentimentBadge[s].label.toLowerCase();

/** UI copy for the sentiment bubble map (#222), Vietnamese since #275. */
export const bubbleMapCopy = {
  title: "Bản đồ cảm xúc",
  description: "Chủ đề trong các bài nhắc đã phân tích",
  filterLabel: "Lọc theo cảm xúc chủ đạo",
  filterAll: "Tất cả",
  canvasLabel: "Bong bóng bản đồ cảm xúc",
  // #389: bubbles too small for in-bubble text are listed under the canvas.
  smallLabel: "Chủ đề nhỏ:",
  smallLabelPhrases: "Cụm từ nhỏ:",
  empty: "Chưa có bài nhắc đã phân tích trong khoảng này",
  emptyFiltered: (s: SentimentLabel) => `Không có chủ đề nào mà cảm xúc ${sentimentWord(s)} chiếm ưu thế.`,
  legend: "Diện tích = bài nhắc có cảm xúc · Độ đậm = tỷ lệ cảm xúc chủ đạo",
  topicCount: (n: number) => `${formatCount(n)} chủ đề`,
  mentions: bubbleCopy.mentions,
  shareLine: bubbleCopy.shareLine,
  hint: "Chọn một bong bóng để xem chi tiết cảm xúc.",
  withSentiment: (n: number) => `${formatCount(n)} bài nhắc có cảm xúc`,
  viewAll: (n: number) => `Xem tất cả ${formatCount(n)} bài nhắc`,
  // #243 Topics | Phrases toggle (FR-148).
  modeLabel: "Nhóm bong bóng theo",
  modeTopics: "Chủ đề",
  modePhrases: "Cụm từ",
  descriptionPhrases: "Cụm từ chính trong các bài nhắc đã phân tích",
  emptyFilteredPhrases: (s: SentimentLabel) => `Không có cụm từ nào mà cảm xúc ${sentimentWord(s)} chiếm ưu thế.`,
  phraseCount: (n: number) => `${formatCount(n)} cụm từ`,
  phraseTop: (shown: number, total: number) => `Top ${formatCount(shown)} trên ${formatCount(total)} cụm từ`,
  emptyPhrases: "Chưa có cụm từ — hãy phân tích lại để trích xuất cụm từ",
  emptyPhrasesDescription:
    "Các bài nhắc được phân tích trước khi có tính năng trích cụm từ sẽ chưa có cụm từ cho tới khi được phân tích lại.",
  emptyPhrasesThreshold: (n: number) => `Không có cụm từ nào đạt ${formatCount(n)} bài nhắc`,
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
  back: "Trang chủ",
  withSentiment: (n: string) => `${n} bài nhắc`,
  /** Hero period (#332): relative presets as words, custom as its dates. */
  period: (filters: Filters, now?: Date) => PERIOD[filters.preset] ?? rangeLabel(filters, now).replace(" – ", "–"),
  none: "Chưa ai nhắc tới cụm từ này trong khoảng thời gian đã chọn.",
  splitLabel: "Tỷ lệ cảm xúc",
  sentiment: { positive: "Tích cực", neutral: "Trung tính", negative: "Tiêu cực" },
  matchNote: "Tính các bài nhắc có cụm này trong nội dung hoặc trong cụm từ khoá — cùng cách đếm với biển ở trang chủ.",
  /** #333 entry-5: change vs the window right before. */
  change: (pct: string) => `${pct} so với kỳ trước`,
  flat: "Không đổi so với kỳ trước",
  newTerm: "Mới trong kỳ này",
  previous: (n: string) => `kỳ trước: ${n}`,
  negativeVsPrevious: (now: string, prev: string) => `Tiêu cực: ${now} (kỳ trước ${prev})`,
  filteredNote: (labels: string) => `Biểu đồ và danh sách bên dưới đang lọc: ${labels}`,
  splitLink: (label: string, rate: string, n: string) => `${label} ${rate} (${n} bài nhắc)`,
  otherTerms: "Cụm từ khác:",
  widenTo30d: "Mở rộng ra 30 ngày",
  home: "Về trang chủ",
} as const;

const PERIOD: Record<string, string | undefined> = {
  "1h": "1 GIỜ QUA",
  "24h": "24 GIỜ QUA",
  "7d": "7 NGÀY QUA",
  "30d": "30 NGÀY QUA",
};
