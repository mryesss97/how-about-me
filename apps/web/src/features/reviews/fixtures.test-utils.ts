import type { MentionDetail, ReviewQueueItem } from "@how-about-me/contracts";

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

/** #390: minimal `MentionDetail` (parses with the contract) for the out-of-list fallback; only `review` matters. */
export function reviewDetailFixture(id: string, review: MentionDetail["review"]): MentionDetail {
  return {
    id,
    platform: "threads",
    platformPostId: "p-detail",
    username: "alice",
    permalink: null,
    publishedAt: "2026-10-13T03:00:00.000Z",
    text: "Giá vé concert quá cao",
    mediaType: null,
    thumbnailUrl: null,
    hasReplies: null,
    isQuotePost: null,
    matchedQueries: [],
    ownerId: null,
    shortcode: null,
    mediaUrl: null,
    altText: null,
    linkAttachmentUrl: null,
    quotedPostId: null,
    repostedPostId: null,
    firstSeenAt: "2026-10-13T03:05:00.000Z",
    lastSeenAt: "2026-10-13T04:00:00.000Z",
    revision: 1,
    contentHash: "h",
    runs: [],
    review,
    analysis: {
      status: "completed",
      source: "ai",
      relevance: { label: "uncertain", confidence: 0.4 },
      sentiment: { label: "negative", confidence: 0.4 },
      safety: { level: "safe" },
      intents: [],
      topics: [],
      language: "vi",
      summary: null,
      overallConfidence: 0.4,
      confidenceBand: "low",
      hasOverride: false,
      relevanceExplanation: null,
      safetyCategoryScores: null,
      safetyTriggered: null,
      versions: null,
      analyzedAt: "2026-10-13T03:10:00.000Z",
      tokens: null,
      estimatedCostUsd: null,
    },
  };
}
