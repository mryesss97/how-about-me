import { describe, expect, it } from "vitest";
import {
  boardLabel,
  boardRanks,
  boardSplit,
  boardTone,
  fallbackRange,
  formatLandingStats,
  landingGrowth,
  toLandingBoards,
  viUpdated,
} from "./landing-data";
import { overviewFixture } from "./landing-fixture.test-utils";

const row = (term: string, positive: number, neutral: number, negative: number) => {
  const total = positive + neutral + negative;
  const max = Math.max(positive, neutral, negative);
  const dominant = !total ? null : negative === max ? "negative" : positive === max ? "positive" : "neutral";
  return { term, positive, neutral, negative, total, dominant, dominantShare: total ? max / total : null } as const;
};

// BR-042, FR-149 (#262, #271)
describe("toLandingBoards", () => {
  it("BR-042: every phrase becomes a board in setting order; 0 mentions → blank", () => {
    const out = toLandingBoards([row("b", 3, 1, 0), row("a", 0, 0, 0)]);
    expect(out.map((b) => b.key)).toEqual(["b", "a"]);
    expect(out[0]).toMatchObject({ dominant: "positive", dominantShare: 0.75, empty: false, total: 4 });
    expect(out[1]).toMatchObject({ dominant: "neutral", dominantShare: 0, empty: true });
  });

  it("#271: Vietnamese label and split with decimal commas; phrase in straight quotes", () => {
    const [full, empty] = toLandingBoards([row("giá vé", 62, 38, 0), row("x", 0, 0, 0)]);
    expect(full && boardLabel(full)).toBe('"giá vé" · 62,0% tích cực · 100 lượt nhắc');
    expect(full && boardSplit(full)).toBe("100 lượt nhắc · 62,0% tích cực · 38,0% trung tính · 0,0% tiêu cực");
    expect(empty && boardLabel(empty)).toBe('"x" · chưa ai nhắc');
  });

  it("#271: ranks by mentions, ties keep setting order", () => {
    const ranks = boardRanks(toLandingBoards([row("a", 1, 0, 0), row("b", 5, 0, 0), row("c", 1, 0, 0)]));
    expect([...ranks.entries()]).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });

  it("#271: enamel tone — solid at ≥ 60% share, mixed below, neutral and blank", () => {
    const boards = toLandingBoards([row("s", 0, 1, 9), row("m", 4, 3, 0), row("n", 1, 5, 1), row("z", 0, 0, 0)]);
    expect(boards.map(boardTone)).toEqual(["negative-solid", "positive-mixed", "neutral", "blank"]);
  });
});

describe("landing figures", () => {
  it("BR-017: four figures, never safety; Vietnamese number format", () => {
    const stats = formatLandingStats(overviewFixture(), new Date("2026-10-14T05:00:00Z"));
    expect(stats.map((s) => s.key)).toEqual(["mentions", "positive", "negative", "lastUpdated"]);
    expect(stats.map((s) => s.value)).toEqual(["1.284", "62,0%", "10,0%", "30 phút trước"]);
    expect(JSON.stringify(stats)).not.toMatch(/safety|an toàn/i);
  });

  it("#267, #271: growth capped at >999% on screen, exact in aria; Mới; null hidden", () => {
    expect(landingGrowth(14150, "up")).toEqual({ text: ">999%", direction: "up", aria: "+14.150,0%" });
    expect(landingGrowth(-12, "down")).toEqual({ text: "12,0%", direction: "down", aria: "−12,0%" });
    expect(landingGrowth(null, "new")).toMatchObject({ text: "Mới", direction: "new" });
    expect(landingGrowth(null, "up")).toBeNull();
  });

  it("never synced → Chưa đồng bộ as a status (small print), not a figure", () => {
    expect(formatLandingStats(overviewFixture({ lastSyncAt: null }))[3]).toMatchObject({
      value: "Chưa đồng bộ",
      status: true,
    });
  });

  it("#271: growth carries its base (previous period count) as small print", () => {
    expect(formatLandingStats(overviewFixture())[0]?.note).toBe("kỳ trước: 1.000");
    expect(formatLandingStats(overviewFixture({ growthState: "new", growthPct: null }))[0]?.note).toBeUndefined();
  });

  it("updated: minutes, hours, then a date in the range timezone", () => {
    const now = new Date("2026-10-14T05:00:00Z");
    expect(viUpdated("2026-10-14T04:59:50Z", now, "Asia/Ho_Chi_Minh")).toBe("vừa xong");
    expect(viUpdated("2026-10-14T02:00:00Z", now, "Asia/Ho_Chi_Minh")).toBe("3 giờ trước");
    expect(viUpdated("2026-10-12T02:30:00Z", now, "Asia/Ho_Chi_Minh")).toBe("12/10 09:30");
  });

  it("fallback range: last 30 days ending at the current minute", () => {
    const r = fallbackRange(new Date("2026-10-14T05:00:30Z"), "Asia/Ho_Chi_Minh");
    expect(r).toEqual({
      from: "2026-09-14T05:00:00.000Z",
      to: "2026-10-14T05:00:00.000Z",
      timezone: "Asia/Ho_Chi_Minh",
    });
  });
});
