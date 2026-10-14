import { describe, expect, it } from "vitest";
import { balloonFits, LANDING_MIN_RADIUS_RATIO, layoutLandingBalloons, MOBILE_MAX_BALLOONS } from "./landing-layout";

const items = Array.from({ length: 14 }, (_, i) => ({ key: `t${i}`, total: i === 13 ? 0 : (14 - i) * 10 }));
const hero = { x: 483, y: 234, width: 400, height: 260 };
const stats = { x: 333, y: 560, width: 700, height: 100 };
const opts = { width: 1366, height: 768, exclude: [hero, stats] };

// #262: landing balloons layout
describe("layoutLandingBalloons", () => {
  it("never covers the hero or stats and stays in the canvas", () => {
    const out = layoutLandingBalloons(items, opts);
    for (const c of out) expect(balloonFits(c, opts)).toBe(true);
  });

  it("#262: shows every configured term on a desktop canvas (shrinks instead of dropping) without overlaps", () => {
    const out = layoutLandingBalloons(items, opts);
    expect(out.map((c) => c.key).sort()).toEqual(items.map((i) => i.key).sort());
    for (const a of out)
      for (const b of out) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
  });

  it("is deterministic", () => {
    expect(layoutLandingBalloons(items, opts)).toEqual(layoutLandingBalloons(items, opts));
  });

  it("BR-042: a 0-mention term still gets at least the minimum radius", () => {
    const out = layoutLandingBalloons(items, { ...opts, maxR: 100 });
    const zero = out.find((c) => c.key === "t13");
    const largest = Math.max(...out.map((c) => c.r));
    expect(zero?.r).toBeGreaterThanOrEqual(largest * LANDING_MIN_RADIUS_RATIO - 0.01);
  });

  it("mobile keeps only the largest N balloons", () => {
    const out = layoutLandingBalloons(items, {
      width: 390,
      height: 2000,
      exclude: [{ x: 0, y: 700, width: 390, height: 400 }],
      maxCount: MOBILE_MAX_BALLOONS,
    });
    expect(out.length).toBeLessThanOrEqual(MOBILE_MAX_BALLOONS);
    expect(out.map((c) => c.key)).not.toContain("t13");
  });

  it("returns [] until the canvas is measured", () => {
    expect(layoutLandingBalloons(items, { width: 0, height: 0 })).toEqual([]);
  });
});
