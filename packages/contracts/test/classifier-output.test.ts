import { describe, expect, it } from "vitest";
import { INTENT_LABELS, LANGUAGE_CODES, TOPIC_LABELS } from "@how-about-me/taxonomy";
import {
  ClassifierOutputJsonSchema,
  ClassifierOutputSchema,
  IntentLabelSchema,
  TopicLabelSchema,
  normalizeClassifierOutput,
  parseClassifierOutput,
  type ClassifierOutput,
} from "../src/index.js";

// docs/02-architecture/07-analysis-pipeline.md §4, FR-119, TC-ANA-010/011.
const valid: ClassifierOutput = {
  relevance: { label: "relevant", confidence: 0.97, explanation: "Ticket price complaint." },
  sentiment: { label: "negative", confidence: 0.91 },
  intents: [{ label: "complaint", confidence: 0.95 }],
  topics: [
    { label: "ticket", confidence: 0.98 },
    { label: "price", confidence: 0.96 },
  ],
  language: "vi",
  summary: "User complains that ticket prices are high.",
};

const fail = (raw: unknown): string[] => {
  const r = parseClassifierOutput(raw);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.issues;
};

describe("normalizeClassifierOutput (TC-ANA-010)", () => {
  it("drops `other` when another label exists, for intents and topics", () => {
    const out = normalizeClassifierOutput({
      ...valid,
      intents: [
        { label: "other", confidence: 0.3 },
        { label: "complaint", confidence: 0.9 },
      ],
      topics: [
        { label: "other", confidence: 0.3 },
        { label: "ticket", confidence: 0.9 },
      ],
    });
    expect(out.intents).toEqual([{ label: "complaint", confidence: 0.9 }]);
    expect(out.topics).toEqual([{ label: "ticket", confidence: 0.9 }]);
  });
  it("keeps `other` when it is the only label (array stays non-empty)", () => {
    const out = normalizeClassifierOutput({
      ...valid,
      intents: [{ label: "other", confidence: 0.4 }],
      topics: [{ label: "other", confidence: 0.5 }],
    });
    expect(out.intents).toEqual([{ label: "other", confidence: 0.4 }]);
    expect(out.topics).toEqual([{ label: "other", confidence: 0.5 }]);
  });
  it("dedupes labels keeping max confidence and model order", () => {
    const out = normalizeClassifierOutput({
      ...valid,
      intents: [
        { label: "question", confidence: 0.6 },
        { label: "complaint", confidence: 0.5 },
        { label: "question", confidence: 0.8 },
      ],
    });
    expect(out.intents).toEqual([
      { label: "question", confidence: 0.8 },
      { label: "complaint", confidence: 0.5 },
    ]);
  });
  it("clamps confidence (1.4 → 1, -0.2 → 0, NaN → 0)", () => {
    const out = normalizeClassifierOutput({
      ...valid,
      relevance: { ...valid.relevance, confidence: Number.NaN },
      intents: [
        { label: "complaint", confidence: 1.4 },
        { label: "question", confidence: -0.2 },
      ],
      topics: [{ label: "ticket", confidence: Number.NaN }],
    });
    expect(out.intents).toEqual([
      { label: "complaint", confidence: 1 },
      { label: "question", confidence: 0 },
    ]);
    expect(out.topics[0]?.confidence).toBe(0);
    expect(out.relevance.confidence).toBe(0);
  });
  it("trims summary and explanation", () => {
    const r = parseClassifierOutput({
      ...valid,
      summary: "  hi  ",
      relevance: { ...valid.relevance, explanation: " why " },
    });
    expect(r.ok && r.value.summary).toBe("hi");
    expect(r.ok && r.value.relevance.explanation).toBe("why");
  });
});

describe("parseClassifierOutput (TC-ANA-011, FR-119)", () => {
  it("accepts valid output and normalises", () => {
    const r = parseClassifierOutput({ ...valid, intents: [...valid.intents, { label: "other", confidence: 0.1 }] });
    expect(r).toEqual({ ok: true, value: valid });
  });
  it("rejects unknown topic label with path", () => {
    const issues = fail({ ...valid, topics: [{ label: "ticketing", confidence: 0.5 }] });
    expect(issues.some((i) => i.startsWith("topics.0.label"))).toBe(true);
  });
  it("rejects unknown intent and language", () => {
    fail({ ...valid, intents: [{ label: "rant", confidence: 0.5 }] });
    fail({ ...valid, language: "fr" });
  });
  it("rejects extra keys top-level and nested", () => {
    fail({ ...valid, extra: 1 });
    fail({ ...valid, sentiment: { ...valid.sentiment, why: "x" } });
    fail({ ...valid, intents: [{ label: "complaint", confidence: 0.5, note: "x" }] });
  });
  it("rejects missing key", () => {
    const { summary: _s, ...rest } = valid;
    expect(fail(rest).some((i) => i.startsWith("summary"))).toBe(true);
  });
  it("rejects confidence > 1", () => {
    fail({ ...valid, sentiment: { label: "negative", confidence: 1.2 } });
  });
  it("rejects empty and >4 label arrays", () => {
    fail({ ...valid, intents: [] });
    fail({ ...valid, topics: Array.from({ length: 5 }, () => ({ label: "ticket", confidence: 0.5 })) });
  });
  it("rejects too-long summary and explanation", () => {
    fail({ ...valid, summary: "x".repeat(241) });
    fail({ ...valid, relevance: { ...valid.relevance, explanation: "x".repeat(201) } });
  });
  it("rejects non-object input", () => {
    expect(fail("nope").length).toBeGreaterThan(0);
  });
});

describe("ClassifierOutputJsonSchema (§4 strict)", () => {
  type Node = Record<string, unknown>;
  const s = ClassifierOutputJsonSchema as Node;
  const props = s.properties as Record<string, Node>;
  const objectNodes = (n: Node): Node[] => {
    const out: Node[] = [];
    if (n.type === "object") out.push(n);
    for (const v of Object.values((n.properties as Record<string, Node> | undefined) ?? {}))
      out.push(...objectNodes(v));
    if (n.items) out.push(...objectNodes(n.items as Node));
    return out;
  };
  const enumOf = (n: Node | undefined): unknown => n?.enum;

  it("every object is closed and requires all its properties", () => {
    const objs = objectNodes(s);
    expect(objs.length).toBe(5);
    for (const o of objs) {
      expect(o.additionalProperties).toBe(false);
      expect([...(o.required as string[])].sort()).toEqual(Object.keys(o.properties as Node).sort());
    }
    expect(s.required).toEqual(["relevance", "sentiment", "intents", "topics", "language", "summary"]);
  });
  it("matches §4 enums and bounds", () => {
    const intents = props.intents as Node;
    const topics = props.topics as Node;
    const itemLabel = (a: Node) => ((a.items as Node).properties as Record<string, Node>).label;
    expect(enumOf(itemLabel(intents))).toEqual([...INTENT_LABELS]);
    expect(enumOf(itemLabel(topics))).toEqual([...TOPIC_LABELS]);
    expect(enumOf(props.language)).toEqual([...LANGUAGE_CODES]);
    for (const a of [intents, topics]) {
      expect(a.minItems).toBe(1);
      expect(a.maxItems).toBe(4);
    }
    const rel = props.relevance?.properties as Record<string, Node>;
    expect(enumOf(rel.label)).toEqual(["relevant", "uncertain", "irrelevant"]);
    expect(rel.confidence).toMatchObject({ minimum: 0, maximum: 1 });
    expect(rel.explanation?.maxLength).toBe(200);
    expect(props.summary?.maxLength).toBe(240);
  });
});

describe("taxonomy ↔ contract drift (FR-119)", () => {
  it("label enums equal taxonomy constants", () => {
    expect(IntentLabelSchema.options).toEqual([...INTENT_LABELS]);
    expect(TopicLabelSchema.options).toEqual([...TOPIC_LABELS]);
    expect(ClassifierOutputSchema.shape.language.options).toEqual([...LANGUAGE_CODES]);
  });
});
