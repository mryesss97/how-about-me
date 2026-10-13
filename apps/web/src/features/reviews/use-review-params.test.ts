import { describe, expect, it } from "vitest";
import { parseReviewParams } from "./use-review-params";

describe("parseReviewParams (UX §3.8)", () => {
  it("defaults: All tab, unreviewed, no item", () => {
    expect(parseReviewParams(new URLSearchParams(""))).toEqual({ reason: undefined, status: "unreviewed", item: null });
  });
  it("invalid reason → All; unknown status → unreviewed", () => {
    expect(parseReviewParams(new URLSearchParams("reason=bogus&status=x"))).toMatchObject({
      reason: undefined,
      status: "unreviewed",
    });
  });
  it("reads reason, status=reviewed and item", () => {
    expect(parseReviewParams(new URLSearchParams("reason=low_confidence&status=reviewed&item=abc"))).toEqual({
      reason: "low_confidence",
      status: "reviewed",
      item: "abc",
    });
  });
});
