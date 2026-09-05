import { describe, expect, it } from "vitest";
import {
  AnalysisFiltersSchema,
  ClassifierOutputSchema,
  CreateListeningQueryBodySchema,
  MentionsListQuerySchema,
  UpdateListeningQueryBodySchema,
  normalizeClassifierOutput,
} from "../src/index.js";

describe("listening query body (FR-052 / BR-004)", () => {
  it("strips leading # and applies defaults", () => {
    const r = CreateListeningQueryBodySchema.parse({
      displayName: "Eventista",
      queryValue: "  #Eventista ",
      queryType: "topic_tag",
    });
    expect(r.queryValue).toBe("Eventista");
    expect(r.pollIntervalSeconds).toBe(600);
    expect(r.overlapSeconds).toBe(1200);
    expect(r.enabled).toBe(true);
  });
  it("rejects out-of-range interval and too many terms", () => {
    expect(() =>
      CreateListeningQueryBodySchema.parse({
        displayName: "x",
        queryValue: "1zone",
        queryType: "keyword",
        pollIntervalSeconds: 30,
      }),
    ).toThrow();
    expect(() =>
      CreateListeningQueryBodySchema.parse({
        displayName: "x",
        queryValue: "1zone",
        queryType: "keyword",
        excludeTerms: Array(51).fill("a"),
      }),
    ).toThrow();
  });
  it("update body cannot carry immutable fields", () => {
    const r = UpdateListeningQueryBodySchema.safeParse({ queryValue: "new" });
    // unknown keys are stripped → object becomes empty → refine fails
    expect(r.success).toBe(false);
  });
  it("update body never injects defaults for unsent fields (PATCH semantics)", () => {
    const r = UpdateListeningQueryBodySchema.parse({ displayName: "Renamed" });
    expect(r).toEqual({ displayName: "Renamed" });
  });
});

describe("filters coercion", () => {
  it("accepts comma lists and repeated keys; defaults relevance to relevant", () => {
    const r = AnalysisFiltersSchema.parse({ sentiment: "positive,negative", topic: ["ticket", "price"] });
    expect(r.sentiment).toEqual(["positive", "negative"]);
    expect(r.topic).toEqual(["ticket", "price"]);
    expect(r.relevance).toEqual(["relevant"]);
  });
  it("mentions list query defaults", () => {
    const r = MentionsListQuerySchema.parse({});
    expect(r.sort).toBe("newest");
    expect(r.limit).toBe(25);
  });
});

describe("classifier output", () => {
  const valid = {
    relevance: { label: "relevant", confidence: 0.97, explanation: "Ticket price complaint." },
    sentiment: { label: "negative", confidence: 0.91 },
    intents: [
      { label: "complaint", confidence: 0.95 },
      { label: "other", confidence: 0.2 },
      { label: "complaint", confidence: 0.5 },
    ],
    topics: [
      { label: "ticket", confidence: 0.98 },
      { label: "price", confidence: 0.96 },
    ],
    language: "vi",
    summary: "User complains that ticket prices are high.",
  };
  it("parses and normalises (other dropped, dedupe keeps max confidence)", () => {
    const out = normalizeClassifierOutput(ClassifierOutputSchema.parse(valid));
    expect(out.intents).toEqual([{ label: "complaint", confidence: 0.95 }]);
  });
  it("rejects unknown labels and extra keys", () => {
    expect(
      ClassifierOutputSchema.safeParse({ ...valid, topics: [{ label: "ticketing", confidence: 0.5 }] }).success,
    ).toBe(false);
    expect(ClassifierOutputSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});
