import { describe, expect, it } from "vitest";
import { EDGE_INSET, orbitRings } from "./landing-geometry";
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

  it("#267: largest orb seeds on the inner ring, nearer the centre than the smallest", () => {
    const out = layoutLandingBalloons(items, { width: 1366, height: 768 });
    const d = (k: string) => {
      const c = out.find((o) => o.key === k);
      return c ? Math.hypot(c.x - 683, c.y - 384) : Number.NaN;
    };
    expect(d("t0")).toBeLessThan(d("t13"));
  });

  it("#267: shows all 14 terms on 1920×1080 too", () => {
    const big = {
      width: 1920,
      height: 1080,
      exclude: [
        { x: 640, y: 330, width: 640, height: 320 },
        { x: 576, y: 820, width: 768, height: 120 },
      ],
    };
    expect(layoutLandingBalloons(items, big)).toHaveLength(14);
  });
});

// #267: orbit rings shared by backdrop and layout
describe("orbitRings", () => {
  it("3 rings on desktop, 2 on mobile; outermost dashed; canvas centre while the content is unmeasured", () => {
    const d = orbitRings(1000, 600, false);
    expect(d).toMatchObject({ cx: 500, cy: 300 });
    expect(d.rings.map((r) => r.dashed)).toEqual([false, false, true]);
    expect(d.rings[0]).toMatchObject({ rx: 210, ry: 126 });
    const m = orbitRings(390, 844, true);
    expect(m.rings).toHaveLength(2);
    expect(m.rings[1]?.dashed).toBe(true);
    expect(m).toMatchObject({ cx: 195, cy: 422 });
  });

  it("#267: centred on the hero + stats block, rings grow from just outside it to EDGE_INSET from the edge", () => {
    const content = { x: 333, y: 180, width: 700, height: 400 };
    const { cx, cy, rings } = orbitRings(1366, 768, false, content);
    expect({ cx, cy }).toEqual({ cx: 683, cy: 380 });
    const inner = rings[0];
    const outer = rings[rings.length - 1];
    expect(inner && inner.rx > content.width / 2 && inner.ry > content.height / 2).toBe(true);
    expect(outer?.rx).toBeCloseTo(683 - EDGE_INSET);
    expect(rings.every((r, i) => i === 0 || r.rx > (rings[i - 1]?.rx ?? 0))).toBe(true);
  });
});
