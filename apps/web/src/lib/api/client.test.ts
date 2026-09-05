import { describe, expect, it } from "vitest";
import { toSearchParams } from "./client";

describe("toSearchParams", () => {
  it("repeats array keys and skips empty values", () => {
    expect(
      toSearchParams({ sentiment: ["positive", "negative"], q: "", cursor: undefined, limit: 25, compare: true }),
    ).toBe("?sentiment=positive&sentiment=negative&limit=25&compare=true");
  });
  it("returns empty string without params", () => {
    expect(toSearchParams()).toBe("");
    expect(toSearchParams({})).toBe("");
  });
});
