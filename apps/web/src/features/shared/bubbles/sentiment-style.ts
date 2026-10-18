import type { SentimentLabel } from "@how-about-me/taxonomy";
import { formatCount, formatRate } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";

/** Sentiment hues for charts and bubbles — sentiment only, never safety (BR-017). Moved from analytics in #262. */
export const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  positive: "var(--color-utility-green-500)",
  neutral: "var(--color-utility-neutral-400)",
  negative: "var(--color-utility-red-500)",
};

/** Copy shared by every bubble surface (sentiment map #222, landing #262). */
export const bubbleCopy = {
  mentions: (n: number) => `${formatCount(n)} bài nhắc`,
  shareLine: (share: number, s: SentimentLabel) => `${formatRate(share)} ${sentimentBadge[s].label.toLowerCase()}`,
  /** #389 small-topics row item: "Giá · 33,3% tiêu cực (3)". */
  smallItem: (name: string, share: number, s: SentimentLabel, total: number) =>
    `${name} · ${formatRate(share)} ${sentimentBadge[s].label.toLowerCase()} (${formatCount(total)})`,
};
