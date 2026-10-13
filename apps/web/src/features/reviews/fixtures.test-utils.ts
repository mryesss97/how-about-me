import type { ReviewQueueItem } from "@how-about-me/contracts";

let n = 0;
export const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

type Over = Partial<Omit<ReviewQueueItem, "analysis">> & { analysis?: Partial<ReviewQueueItem["analysis"]> };

export function reviewFixture(over: Over = {}): ReviewQueueItem {
  n += 1;
  return {
    id: uuid(n),
    platform: "threads",
    platformPostId: `p${n}`,
    username: `user${n}`,
    permalink: null,
    publishedAt: "2026-10-13T03:00:00.000Z",
    text: "Giá vé concert quá cao",
    reasons: ["uncertain"],
    reviewedAt: null,
    reviewedBy: null,
    ...over,
    analysis: {
      status: "completed",
      relevance: "uncertain",
      sentiment: "negative",
      overallConfidence: 0.42,
      confidenceBand: "low",
      errorCode: null,
      hasOverride: false,
      ...over.analysis,
    },
  };
}
