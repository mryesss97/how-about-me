import type { ReviewQueuePage } from "@how-about-me/contracts";
import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { canMarkReviewed, removeFromQueue, reviewQueueParams } from "./api";
import { reviewFixture } from "./fixtures.test-utils";

const a = reviewFixture({ reasons: ["uncertain", "low_confidence"] });
const b = reviewFixture({ reasons: ["failed"] });
const c = reviewFixture({ reasons: ["uncertain"] });

const data = (counts?: ReviewQueuePage["counts"]): InfiniteData<ReviewQueuePage> => ({
  pageParams: [null, "c1"],
  pages: [
    { items: [a, b], nextCursor: "c1", totalCount: 3, counts },
    { items: [c], nextCursor: null },
  ],
});

// FR-195 / BR-040: optimistic mark-reviewed.
describe("removeFromQueue", () => {
  it("drops marked rows and decrements counts per reason", () => {
    const out = removeFromQueue(data({ all: 3, uncertain: 2, lowConfidence: 1, failed: 1 }), new Set([a.id, c.id]));
    expect(out?.pages.flatMap((p) => p.items.map((i) => i.id))).toEqual([b.id]);
    expect(out?.pages[0]?.counts).toEqual({ all: 1, uncertain: 0, lowConfidence: 0, failed: 1 });
    expect(out?.pages[0]?.totalCount).toBe(1);
  });
  it("keeps absent counts absent (count timed out)", () => {
    const out = removeFromQueue(data(), new Set([b.id]));
    expect(out?.pages[0]?.counts).toBeUndefined();
  });
  it("returns the same data when no id matches", () => {
    const d = data();
    expect(removeFromQueue(d, new Set(["x"]))).toBe(d);
  });
});

describe("reviewQueueParams", () => {
  it("count=true on the first page only", () => {
    expect(reviewQueueParams({ status: "unreviewed" }, null)).toEqual({
      status: "unreviewed",
      limit: "25",
      count: "true",
    });
    expect(reviewQueueParams({ reason: "failed", status: "reviewed" }, "cur")).toEqual({
      reason: "failed",
      status: "reviewed",
      limit: "25",
      cursor: "cur",
    });
  });
});

// FR-015: viewer is read-only.
describe("canMarkReviewed", () => {
  it("admin and analyst only", () => {
    expect(canMarkReviewed("admin")).toBe(true);
    expect(canMarkReviewed("analyst")).toBe(true);
    expect(canMarkReviewed("viewer")).toBe(false);
    expect(canMarkReviewed(null)).toBe(false);
  });
});
