import type { MentionListItem } from "@how-about-me/contracts";

let n = 0;
export const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

type Over = Partial<Omit<MentionListItem, "analysis">> & { analysis?: Partial<MentionListItem["analysis"]> };

export function mentionFixture(over: Over = {}): MentionListItem {
  n += 1;
  return {
    id: uuid(n),
    platform: "threads",
    platformPostId: `p${n}`,
    username: "alice",
    permalink: "https://www.threads.net/@alice/post/1",
    publishedAt: "2026-10-13T03:00:00.000Z",
    text: "Giá vé concert quá cao",
    mediaType: null,
    thumbnailUrl: null,
    hasReplies: null,
    isQuotePost: null,
    matchedQueries: [],
    ...over,
    analysis: {
      status: "completed",
      source: "ai",
      relevance: { label: "relevant", confidence: 0.9 },
      sentiment: { label: "negative", confidence: 0.8 },
      safety: { level: "safe" },
      intents: [],
      topics: [],
      language: "vi",
      summary: null,
      overallConfidence: 0.8,
      confidenceBand: "high",
      hasOverride: false,
      ...over.analysis,
    },
  };
}
