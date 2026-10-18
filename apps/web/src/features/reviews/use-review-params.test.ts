import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { parseReviewParams, useReviewParams } from "./use-review-params";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams("reason=uncertain&item=a"),
}));

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

// #339: next/prev replaces history so Back still closes the slide-out; tab filters are kept.
describe("useReviewParams.moveToItem (#339)", () => {
  it("replaces ?item and keeps reason", () => {
    const { result } = renderHook(() => useReviewParams());
    result.current.moveToItem("b");
    expect(replace).toHaveBeenCalledWith("/reviews?reason=uncertain&item=b");
    expect(push).not.toHaveBeenCalled();
  });
});
