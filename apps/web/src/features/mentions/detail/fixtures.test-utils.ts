import type { MentionDetail } from "@how-about-me/contracts";
import { mentionFixture, uuid } from "../fixtures.test-utils";

type Over = Partial<Omit<MentionDetail, "analysis">> & { analysis?: Partial<MentionDetail["analysis"]> };

export function detailFixture(over: Over = {}): MentionDetail {
  const base = mentionFixture();
  return {
    ...base,
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
    ...over,
    analysis: {
      ...base.analysis,
      relevanceExplanation: null,
      safetyCategoryScores: null,
      safetyTriggered: null,
      versions: null,
      analyzedAt: "2026-10-13T03:10:00.000Z",
      tokens: null,
      estimatedCostUsd: null,
      ...over.analysis,
    },
  };
}

export { uuid };
