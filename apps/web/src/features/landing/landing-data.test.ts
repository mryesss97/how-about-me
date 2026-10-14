import { describe, expect, it } from "vitest";
import { overviewFixture } from "./landing-fixture.test-utils";
import { balloonLabel, fallbackRange, formatLandingStats, toLandingBubbles } from "./landing-data";

const row = (term: string, positive: number, neutral: number, negative: number) => {
  const total = positive + neutral + negative;
  return {
    term,
    positive,
    neutral,
    negative,
    total,
    dominant: total ? ("positive" as const) : null,
    dominantShare: total ? positive / total : null,
  };
};

// BR-042, FR-149 (#262)
describe("toLandingBubbles", () => {
  it("BR-042: every term becomes a balloon in setting order; 0 mentions → empty neutral share 0", () => {
    const out = toLandingBubbles([row("b", 3, 1, 0), row("a", 0, 0, 0)]);
    expect(out.map((b) => b.key)).toEqual(["b", "a"]);
    expect(out[0]).toMatchObject({ dominant: "positive", dominantShare: 0.75, empty: false, total: 4 });
    expect(out[1]).toMatchObject({ dominant: "neutral", dominantShare: 0, empty: true, total: 0 });
  });

  it("balloon label: term · share · mentions; empty → no mentions", () => {
    const [full, empty] = toLandingBubbles([row("giá vé", 62, 38, 0), row("x", 0, 0, 0)]).map(balloonLabel);
    expect(full).toBe("giá vé · 62.0% positive · 100 mentions");
    expect(empty).toBe("x · no mentions");
  });
});

// FR-132, BR-017 (#262)
describe("formatLandingStats", () => {
  const now = new Date("2026-10-14T05:00:00Z");
  it("formats mentions + growth, rates and last updated; no safety stat (BR-017)", () => {
    const s = formatLandingStats(overviewFixture(), now);
    expect(s.map((x) => x.key)).toEqual(["mentions", "positive", "negative", "lastUpdated"]);
    expect(s[0]).toMatchObject({ value: "1,284", growth: { text: "12.0%", direction: "up", aria: "+12.0%" } });
    expect(s[1]?.value).toBe("62.0%");
    expect(s[2]?.value).toBe("10.0%");
    expect(s[3]?.value).toBe("30 min ago");
    expect(JSON.stringify(s).toLowerCase()).not.toContain("safety");
  });

  it.each([
    [
      { growthPct: -5, growthState: "down" as const },
      { text: "5.0%", direction: "down", aria: "−5.0%" },
    ],
    [
      { growthPct: null, growthState: "new" as const },
      { text: "New", direction: "new", aria: "New" },
    ],
    [
      { growthPct: 0, growthState: "flat" as const },
      { text: "0%", direction: "flat", aria: "0%" },
    ],
    [
      { growthPct: 14150, growthState: "up" as const },
      { text: ">999%", direction: "up", aria: "+14150.0%" },
    ],
    [{ growthPct: null, growthState: "up" as const }, null],
  ])("#267 growth %o → %o", (over, growth) => {
    expect(formatLandingStats(overviewFixture(over), now)[0]?.growth).toEqual(growth);
  });

  it("#267: lastSyncAt null → Not synced", () => {
    expect(formatLandingStats(overviewFixture({ lastSyncAt: null }), now)[3]?.value).toBe("Not synced");
  });
});

describe("fallbackRange", () => {
  it("30 days ending at now floored to the minute, in the given tz", () => {
    expect(fallbackRange(new Date("2026-10-14T05:00:42Z"), "UTC")).toEqual({
      from: "2026-09-14T05:00:00.000Z",
      to: "2026-10-14T05:00:00.000Z",
      timezone: "UTC",
    });
  });
});
