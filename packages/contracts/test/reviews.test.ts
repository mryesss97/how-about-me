import { describe, expect, it } from "vitest";
import {
  MarkReviewedBodySchema,
  MentionsListQuerySchema,
  ReviewQueuePageSchema,
  ReviewQueueQuerySchema,
} from "../src/index.js";

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

// FR-195, T-144: review queue contracts.
describe("review queue contracts (FR-195)", () => {
  it("query: status defaults to unreviewed; unknown reason is rejected", () => {
    const q = ReviewQueueQuerySchema.parse({});
    expect(q).toMatchObject({ status: "unreviewed", limit: 25, count: false });
    expect(q.reason).toBeUndefined();
    expect(ReviewQueueQuerySchema.parse({ reason: "low_confidence", count: "true" }).count).toBe(true);
    expect(ReviewQueueQuerySchema.safeParse({ reason: "irrelevant" }).success).toBe(false);
    expect(ReviewQueueQuerySchema.safeParse({ status: "all" }).success).toBe(false);
  });

  it("mark-reviewed body: 1..50 uuids", () => {
    expect(MarkReviewedBodySchema.safeParse({ postIds: [uuid(1)] }).success).toBe(true);
    expect(MarkReviewedBodySchema.safeParse({ postIds: [] }).success).toBe(false);
    expect(MarkReviewedBodySchema.safeParse({ postIds: Array.from({ length: 51 }, (_, i) => uuid(i)) }).success).toBe(
      false,
    );
    expect(MarkReviewedBodySchema.safeParse({ postIds: ["nope"] }).success).toBe(false);
  });

  it("page: counts optional; reasons non-empty", () => {
    expect(ReviewQueuePageSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
    const item = {
      id: uuid(1),
      platform: "threads",
      platformPostId: "1",
      username: null,
      permalink: null,
      publishedAt: "2026-10-12T00:00:00Z",
      text: null,
      reasons: [],
      analysis: {
        status: "failed",
        relevance: null,
        sentiment: null,
        overallConfidence: null,
        confidenceBand: null,
        errorCode: "PROVIDER_TIMEOUT",
        hasOverride: false,
      },
      reviewedAt: null,
      reviewedBy: null,
    };
    expect(ReviewQueuePageSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(false);
  });

  it("BR-040: mentions reviewStatus accepts reviewed/unreviewed CSV", () => {
    expect(MentionsListQuerySchema.parse({ reviewStatus: "reviewed,unreviewed" }).reviewStatus).toEqual([
      "reviewed",
      "unreviewed",
    ]);
    expect(MentionsListQuerySchema.safeParse({ reviewStatus: "maybe" }).success).toBe(false);
  });
});
