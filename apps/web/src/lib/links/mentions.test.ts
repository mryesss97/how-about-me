import { describe, expect, it } from "vitest";
import { mentionsAllRelevanceHref, mentionsHref } from "./mentions";

describe("mentions links", () => {
  it("#391 / BR-016: all-relevance link widens the relevant-only default, 30d window", () => {
    expect(mentionsAllRelevanceHref("q1")).toBe(
      "/mentions?queryIds=q1&preset=30d&relevance=relevant,uncertain,irrelevant",
    );
  });

  it("mentionsHref is unchanged", () => {
    expect(mentionsHref("q1")).toBe("/mentions?queryIds=q1");
    expect(mentionsHref("q1", "24h")).toBe("/mentions?queryIds=q1&preset=24h");
  });
});
