import { describe, expect, it } from "vitest";
import {
  confidenceBand,
  effectiveRelevance,
  INTENT_CUES,
  INTENT_GUIDE,
  INTENT_LABELS,
  LANGUAGE_CODES,
  LANGUAGE_GUIDE,
  normalizeMultiLabel,
  overallConfidence,
  RELEVANCE_GUIDE,
  RELEVANCE_LABELS,
  renderTaxonomyGuide,
  SENTIMENT_GUIDE,
  SENTIMENT_LABELS,
  TOPIC_GUIDE,
  TOPIC_LABELS,
} from "../src/index.js";

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

// BR-019, FR-107/FR-108: label sets and guides.
describe("taxonomy-v1 labels & guides", () => {
  it("has the documented cardinalities", () => {
    expect(INTENT_LABELS).toHaveLength(11);
    expect(TOPIC_LABELS).toHaveLength(12);
    expect(RELEVANCE_LABELS).toHaveLength(3);
    expect(SENTIMENT_LABELS).toHaveLength(3);
    expect(LANGUAGE_CODES).toHaveLength(8);
  });
  it.each([
    [INTENT_LABELS, INTENT_GUIDE],
    [TOPIC_LABELS, TOPIC_GUIDE],
    [RELEVANCE_LABELS, RELEVANCE_GUIDE],
    [SENTIMENT_LABELS, SENTIMENT_GUIDE],
    [LANGUAGE_CODES, LANGUAGE_GUIDE],
  ] as [readonly string[], Record<string, string>][])("guide covers every label (%#)", (labels, guide) => {
    expect(Object.keys(guide).sort()).toEqual([...labels].sort());
    for (const l of labels) expect(guide[l]?.length).toBeGreaterThan(0);
  });
  it("INTENT_CUES covers every intent; `other` has none", () => {
    expect(Object.keys(INTENT_CUES).sort()).toEqual([...INTENT_LABELS].sort());
    expect(INTENT_CUES.other).toEqual([]);
  });
  it("renderTaxonomyGuide is deterministic and lists every label", () => {
    const g = renderTaxonomyGuide();
    expect(g.startsWith("# taxonomy-v1")).toBe(true);
    expect(renderTaxonomyGuide()).toBe(g);
    for (const l of [...INTENT_LABELS, ...TOPIC_LABELS, ...RELEVANCE_LABELS, ...SENTIMENT_LABELS, ...LANGUAGE_CODES])
      expect(g).toContain(`\`${l}\``);
    expect(g).toContain("tẩy chay");
  });
  it("normalizeMultiLabel keeps spam with recommendation (scalper posts)", () => {
    expect(normalizeMultiLabel(["spam", "recommendation"], INTENT_LABELS)).toEqual(["spam", "recommendation"]);
  });
});

// BR-021, doc 08 §8: low-confidence relevance → uncertain.
describe("effectiveRelevance", () => {
  it("keeps label at 0.60 and downgrades below", () => {
    expect(effectiveRelevance("relevant", 0.6)).toBe("relevant");
    expect(effectiveRelevance("relevant", 0.5999)).toBe("uncertain");
    expect(effectiveRelevance("irrelevant", 0.5999)).toBe("uncertain");
    expect(effectiveRelevance("uncertain", 0.95)).toBe("uncertain");
  });
});
