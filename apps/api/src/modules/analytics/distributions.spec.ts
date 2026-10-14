import { INTENT_LABELS, TOPIC_LABELS } from "@how-about-me/taxonomy";
import { bucketInterval } from "../../common/time/range";
import {
  compareCodePoints,
  sortByCountDesc,
  toDistribution,
  toPhraseSentimentRows,
  toTopicSentimentRows,
  toTopicsDistribution,
} from "./distributions";

/** T-093 pure helpers — metric-definitions §3.1–3.6, FR-140. */
describe("distributions helpers (T-093)", () => {
  it("toDistribution fills missing labels with 0 in taxonomy order", () => {
    const d = toDistribution(["positive", "neutral", "negative"], [{ label: "negative", count: 1 }], 4);
    expect(d).toEqual([
      { label: "positive", count: 0, share: 0 },
      { label: "neutral", count: 0, share: 0 },
      { label: "negative", count: 1, share: 0.25 },
    ]);
  });

  it("share is null when denominator = 0 (FR-140)", () => {
    expect(toDistribution(["safe"], [], 0)).toEqual([{ label: "safe", count: 0, share: null }]);
  });

  it("intents: all labels, sorted desc, ties keep taxonomy order", () => {
    const d = sortByCountDesc(
      toDistribution(
        INTENT_LABELS,
        [
          { label: "question", count: 2 },
          { label: "complaint", count: 2 },
          { label: "other", count: 3 },
        ],
        4,
      ),
    );
    expect(d).toHaveLength(INTENT_LABELS.length);
    expect(d.slice(0, 3).map((x) => x.label)).toEqual(["other", "complaint", "question"]);
    expect(d[3]?.label).toBe("praise");
  });

  it("topics: real labels ranked, max 12, `other` bucket last with its distinct count", () => {
    const d = toTopicsDistribution(
      TOPIC_LABELS,
      [
        { label: "venue", count: 5 },
        { label: "ticket", count: 5 },
      ],
      2,
      8,
    );
    expect(d.map((x) => x.label)).toEqual([
      "ticket",
      "venue",
      ...TOPIC_LABELS.filter((l) => l !== "other" && l !== "ticket" && l !== "venue"),
      "other",
    ]);
    expect(d.at(-1)).toEqual({ label: "other", count: 2, share: 0.25 });
    expect(d.filter((x) => x.label === "other")).toHaveLength(1);
  });

  it("topics: cuts to top 12 when the taxonomy grows", () => {
    const labels = Array.from({ length: 14 }, (_, i) => `t${i}`);
    const d = toTopicsDistribution(
      labels,
      labels.map((label, i) => ({ label, count: i })),
      3,
      20,
    );
    expect(d).toHaveLength(13);
    expect(d[0]?.label).toBe("t13");
    expect(d.at(-1)?.label).toBe("other");
  });

  it("sentiment timeseries interval: hour up to 48h, day beyond (§3.1)", () => {
    const from = new Date("2026-10-01T00:00:00Z");
    expect(bucketInterval({ from, to: new Date(from.getTime() + 48 * 3600e3) })).toBe("hour");
    expect(bucketInterval({ from, to: new Date(from.getTime() + 48 * 3600e3 + 1) })).toBe("day");
  });
});

/** T-149 — FR-144, FR-140; metric-definitions §4 Topic × sentiment. */
describe("toTopicSentimentRows", () => {
  it("returns all 12 taxonomy rows, zero rows have negativeShare null (FR-140)", () => {
    const rows = toTopicSentimentRows(TOPIC_LABELS, []);
    expect(rows).toHaveLength(TOPIC_LABELS.length);
    expect(rows.every((r) => r.total === 0 && r.negativeShare === null)).toBe(true);
    expect(rows.at(-1)?.topic).toBe("other");
  });

  it("total = positive + neutral + negative and negativeShare = negative / total (FR-144)", () => {
    const rows = toTopicSentimentRows(TOPIC_LABELS, [
      { topic: "ticket", sentiment: "positive", count: 1 },
      { topic: "ticket", sentiment: "neutral", count: 1 },
      { topic: "ticket", sentiment: "negative", count: 2 },
    ]);
    expect(rows[0]).toEqual({ topic: "ticket", positive: 1, neutral: 1, negative: 2, total: 4, negativeShare: 0.5 });
  });

  it("sorts total desc, ties keep taxonomy order, `other` last even when largest", () => {
    const rows = toTopicSentimentRows(TOPIC_LABELS, [
      { topic: "other", sentiment: "negative", count: 9 },
      { topic: "venue", sentiment: "neutral", count: 2 },
      { topic: "price", sentiment: "neutral", count: 2 },
      { topic: "artist", sentiment: "positive", count: 1 },
    ]);
    expect(rows.slice(0, 3).map((r) => r.topic)).toEqual(["venue", "price", "artist"]);
    expect(rows.at(-1)).toMatchObject({ topic: "other", negative: 9, negativeShare: 1 });
  });

  it("ignores topics and sentiments outside the taxonomy", () => {
    const rows = toTopicSentimentRows(TOPIC_LABELS, [
      { topic: "legacy_label", sentiment: "negative", count: 5 },
      { topic: "ticket", sentiment: "mixed", count: 5 },
    ]);
    expect(rows).toHaveLength(TOPIC_LABELS.length);
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });
});

// FR-148, FR-140, FR-147: phrase × sentiment rows.
describe("toPhraseSentimentRows (FR-148)", () => {
  const cells = [
    { phrase: "giá vé", sentiment: "negative", count: 3 },
    { phrase: "giá vé", sentiment: "positive", count: 1 },
    { phrase: "check-in", sentiment: "neutral", count: 4 },
    { phrase: "app lỗi", sentiment: "negative", count: 4 },
    { phrase: "đỉnh quá", sentiment: "positive", count: 1 },
    { phrase: "x", sentiment: "mixed", count: 9 },
  ];
  it("totals = pos + neu + neg, negativeShare, unknown sentiments ignored", () => {
    const rows = toPhraseSentimentRows(cells, { limit: 30, minMentions: 1 });
    expect(rows.find((r) => r.phrase === "giá vé")).toEqual({
      phrase: "giá vé",
      positive: 1,
      neutral: 0,
      negative: 3,
      total: 4,
      negativeShare: 0.75,
    });
    expect(rows.some((r) => r.phrase === "x")).toBe(false);
  });
  it("sorts total desc then phrase by code point; applies minMentions and limit", () => {
    const rows = toPhraseSentimentRows(cells, { limit: 30, minMentions: 2 });
    expect(rows.map((r) => r.phrase)).toEqual(["app lỗi", "check-in", "giá vé"]);
    expect(toPhraseSentimentRows(cells, { limit: 2, minMentions: 1 }).map((r) => r.phrase)).toEqual([
      "app lỗi",
      "check-in",
    ]);
  });
  it("empty input → []", () => {
    expect(toPhraseSentimentRows([], { limit: 30, minMentions: 2 })).toEqual([]);
  });
  it('ties sort by code point like SQL COLLATE "C", also past the BMP', () => {
    // U+1F600 (surrogate pair 0xD83D…) vs U+FF01: UTF-16 `<` puts the emoji first, code point order does not.
    expect(compareCodePoints("😀", "！")).toBeGreaterThan(0);
    expect(compareCodePoints("giá vé", "giá")).toBeGreaterThan(0);
    const cells = [
      { phrase: "😀 vui", sentiment: "positive", count: 2 },
      { phrase: "！hay", sentiment: "positive", count: 2 },
    ];
    expect(toPhraseSentimentRows(cells, { limit: 30, minMentions: 1 }).map((r) => r.phrase)).toEqual([
      "！hay",
      "😀 vui",
    ]);
  });
});
