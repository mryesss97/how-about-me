import { describe, expect, it } from "vitest";
import {
  BUBBLE_MAX_MIX,
  BUBBLE_MIN_MIX,
  bubbleIntensity,
  dominantSentiment,
  filterBubbles,
  layoutBubbles,
  MIN_RADIUS_RATIO,
  toPhraseBubbles,
  toTopicBubbles,
} from "./bubble-layout";
import { topicSentimentFixture } from "./topic-sentiment-fixture.test-utils";

const row = (positive: number, neutral: number, negative: number) => ({
  positive,
  neutral,
  negative,
  total: positive + neutral + negative,
});

/** #222 — FR-144, BR-032, doc 07 §3 (sentiment map). */
describe("bubble-layout (#222)", () => {
  it("FR-144: dominant sentiment and share; tie-break negative > positive > neutral; total 0 → null (BR-032)", () => {
    expect(dominantSentiment(row(1, 1, 2))).toEqual({ dominant: "negative", share: 0.5 });
    expect(dominantSentiment(row(3, 0, 1))).toEqual({ dominant: "positive", share: 0.75 });
    expect(dominantSentiment(row(2, 0, 2))?.dominant).toBe("negative");
    expect(dominantSentiment(row(1, 1, 0))?.dominant).toBe("positive");
    expect(dominantSentiment(row(0, 3, 0))).toEqual({ dominant: "neutral", share: 1 });
    expect(dominantSentiment(row(0, 0, 0))).toBeNull();
  });

  it("BR-032: toTopicBubbles drops topics without sentiment and keeps API order", () => {
    const data = toTopicBubbles(topicSentimentFixture().rows);
    expect(data.map((d) => d.key)).toEqual(["ticket", "price", "venue", "other"]);
    expect(data[0]).toMatchObject({ name: "Vé", total: 4, dominant: "negative", dominantShare: 0.5 });
  });

  it("bubbleIntensity maps [1/3, 1] to [min, max], clamped and increasing", () => {
    expect(bubbleIntensity(1 / 3)).toBeCloseTo(BUBBLE_MIN_MIX);
    expect(bubbleIntensity(1)).toBeCloseTo(BUBBLE_MAX_MIX);
    expect(bubbleIntensity(0)).toBeCloseTo(BUBBLE_MIN_MIX);
    expect(bubbleIntensity(2)).toBeCloseTo(BUBBLE_MAX_MIX);
    expect(bubbleIntensity(0.6)).toBeLessThan(bubbleIntensity(0.8));
  });

  it("filterBubbles filters by dominant sentiment", () => {
    const data = toTopicBubbles(topicSentimentFixture().rows);
    expect(filterBubbles(data, "all")).toHaveLength(4);
    expect(filterBubbles(data, "negative").map((d) => d.key)).toEqual(["ticket", "venue", "other"]);
    expect(filterBubbles(data, "positive").map((d) => d.key)).toEqual(["price"]);
    expect(filterBubbles(data, "neutral")).toEqual([]);
  });

  const items = [
    { key: "a", total: 400 },
    { key: "b", total: 100 },
    { key: "c", total: 64 },
    { key: "d", total: 36 },
    { key: "e", total: 1 },
  ];
  const size = { width: 1000, height: 560 };

  it("layout is deterministic (same input ⇒ same output)", () => {
    expect(layoutBubbles(items, size)).toEqual(layoutBubbles(items, size));
  });

  it("area ∝ total above the min radius; small topics get the min radius", () => {
    const pos = layoutBubbles(items, size);
    const r = (k: string) => pos.find((p) => p.key === k)?.r ?? 0;
    expect((r("b") / r("a")) ** 2).toBeCloseTo(100 / 400, 2);
    expect((r("c") / r("a")) ** 2).toBeCloseTo(64 / 400, 2);
    expect(r("e") / r("a")).toBeCloseTo(MIN_RADIUS_RATIO, 2);
  });

  it("no overlap and every bubble inside the canvas", () => {
    for (const s of [size, { width: 400, height: 360 }, { width: 1400, height: 400 }]) {
      const pos = layoutBubbles(items, s);
      pos.forEach((p, i) => {
        expect(p.x - p.r).toBeGreaterThanOrEqual(-0.01);
        expect(p.x + p.r).toBeLessThanOrEqual(s.width + 0.01);
        expect(p.y - p.r).toBeGreaterThanOrEqual(-0.01);
        expect(p.y + p.r).toBeLessThanOrEqual(s.height + 0.01);
        for (const q of pos.slice(i + 1)) {
          expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(p.r + q.r - 0.05);
        }
      });
    }
  });

  it("zero size falls back without NaN; single bubble is centred", () => {
    const pos = layoutBubbles(items, { width: 0, height: 0 });
    expect(pos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.r > 0)).toBe(true);
    const [one] = layoutBubbles([{ key: "a", total: 3 }], size);
    expect(one).toMatchObject({ x: 500, y: 280 });
    expect(layoutBubbles([], size)).toEqual([]);
  });
});

describe("toPhraseBubbles (#243, FR-148)", () => {
  const prow = (phrase: string, p: number, n: number, neg: number) => ({
    phrase,
    positive: p,
    neutral: n,
    negative: neg,
    total: p + n + neg,
    negativeShare: p + n + neg ? neg / (p + n + neg) : 0,
  });

  it("keeps the phrase verbatim, drops total 0 (BR-032), ties go negative first", () => {
    const data = toPhraseBubbles([prow("giá vé", 2, 0, 2), prow("empty_one", 0, 0, 0), prow("xếp hàng", 1, 3, 0)]);
    expect(data.map((d) => [d.key, d.name, d.dominant])).toEqual([
      ["giá vé", "giá vé", "negative"],
      ["xếp hàng", "xếp hàng", "neutral"],
    ]);
  });
});
