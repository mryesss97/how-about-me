import type { SentimentLabel } from "@how-about-me/taxonomy";
import { FaceFrown, FaceNeutral, FaceSmile } from "@untitledui/icons";
import { cx } from "@/utils/cx";

const ICONS = { positive: FaceSmile, neutral: FaceNeutral, negative: FaceFrown } as const;
const TONE: Record<SentimentLabel, string> = {
  positive: "text-utility-green-500",
  neutral: "text-utility-neutral-500",
  negative: "text-utility-red-500",
};

/** Sentiment icon matching `sentimentBadge` (NFR-030: colour is never the only cue). */
export function SentimentIcon({ sentiment, className }: { sentiment: SentimentLabel; className?: string }) {
  const Icon = ICONS[sentiment];
  return <Icon aria-hidden data-icon={sentiment} className={cx("size-4 shrink-0", TONE[sentiment], className)} />;
}
