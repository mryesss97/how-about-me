import type { SentimentLabel } from "@how-about-me/taxonomy";
import { formatCount, formatRate } from "@/lib/format/number";

/** Sentiment hues for charts and bubbles — sentiment only, never safety (BR-017). Moved from analytics in #262. */
export const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  positive: "var(--color-utility-green-500)",
  neutral: "var(--color-utility-neutral-400)",
  negative: "var(--color-utility-red-500)",
};

/** Copy shared by every bubble surface (sentiment map #222, landing #262). */
export const bubbleCopy = {
  mentions: (n: number) => `${formatCount(n)} ${n === 1 ? "mention" : "mentions"}`, // "đề cập"
  shareLine: (share: number, s: SentimentLabel) => `${formatRate(share)} ${s}`,
};
