import { describe, expect, it } from "vitest";
import { confidenceBand, INTENT_LABELS, normalizeMultiLabel, overallConfidence, TOPIC_LABELS } from "../src/index.js";

describe("normalizeMultiLabel", () => {
  it("drops `other` when co-occurring and dedupes", () => {
    expect(normalizeMultiLabel(["other", "complaint", "complaint"], INTENT_LABELS)).toEqual(["complaint"]);
  });
  it("keeps `other` alone", () => {
    expect(normalizeMultiLabel(["other"], TOPIC_LABELS)).toEqual(["other"]);
  });
  it("drops unknown labels", () => {
    expect(normalizeMultiLabel(["ticketing" as never, "ticket"], TOPIC_LABELS)).toEqual(["ticket"]);
  });
});

describe("confidence", () => {
  it("bands per BR-021", () => {
    expect(confidenceBand(0.8)).toBe("high");
    expect(confidenceBand(0.79)).toBe("medium");
    expect(confidenceBand(0.6)).toBe("medium");
    expect(confidenceBand(0.59)).toBe("low");
  });
  it("overall = min(relevance, sentiment)", () => {
    expect(overallConfidence(0.9, 0.7)).toBe(0.7);
    expect(overallConfidence(0.9, null)).toBe(0.9);
  });
});
