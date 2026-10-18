import { describe, expect, it } from "vitest";
import {
  type BoardRect,
  WALL_GAP,
  MIN_WEIGHT_SHARE,
  boardWeights,
  layoutSignWall,
  PHONE_LEAD_H,
  phoneWallLayout,
  phraseFit,
  regionsAround,
  squarify,
} from "./sign-wall-layout";

const terms = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `t${i}`, total: i === n - 1 ? 0 : (n - i) * 7 }));

/** Main sign as the view places it: centred, ~44–62% wide. */
const holeFor = (w: number, h: number) => {
  const width = Math.min(Math.max(400, w * (w >= 1024 ? 0.44 : 0.62)), w >= 1024 ? 680 : 560);
  const height = Math.min(470, h * 0.6);
  return { x: (w - width) / 2, y: h * 0.47 - height / 2, width, height };
};

const overlaps = (a: BoardRect, b: BoardRect) =>
  a.x < b.x + b.width - 0.01 &&
  b.x < a.x + a.width - 0.01 &&
  a.y < b.y + b.height - 0.01 &&
  b.y < a.y + a.height - 0.01;
const intersects = (a: BoardRect, r: { x: number; y: number; width: number; height: number }) =>
  a.x < r.x + r.width && r.x < a.x + a.width && a.y < r.y + r.height && r.y < a.y + a.height;

// #271 signboard wall; #270 every phrase on tablet widths
describe("layoutSignWall", () => {
  const sizes: [number, number][] = [
    [1366, 768],
    [1920, 1080],
    [1024, 768],
    [768, 1024],
    [820, 1180],
    [1180, 820],
    [726, 863],
    [640, 900],
  ];
  for (const [w, h] of sizes) {
    for (const n of [13, 20]) {
      it(`#270: ${n} phrases at ${w}×${h} — all shown, inside the wall, off the main sign, no overlap`, () => {
        const hole = holeFor(w, h);
        const out = layoutSignWall(terms(n), { width: w, height: h, hole });
        expect(out.map((b) => b.key).sort()).toEqual(
          terms(n)
            .map((t) => t.key)
            .sort(),
        );
        for (const b of out) {
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width).toBeLessThanOrEqual(w + 0.01);
          expect(b.y + b.height).toBeLessThanOrEqual(h + 0.01);
          expect(intersects(b, hole)).toBe(false);
          expect(b.width).toBeGreaterThan(40);
          expect(b.height).toBeGreaterThan(40);
        }
        for (const a of out) for (const b of out) if (a !== b) expect(overlaps(a, b)).toBe(false);
      });
    }
  }

  it("is deterministic and returns [] while unmeasured", () => {
    const opts = { width: 1366, height: 768, hole: holeFor(1366, 768) };
    expect(layoutSignWall(terms(13), opts)).toEqual(layoutSignWall(terms(13), opts));
    expect(layoutSignWall(terms(13), { width: 0, height: 0 })).toEqual([]);
  });

  it("#271: the largest phrase hangs against the main sign, sharing a full edge", () => {
    for (const [w, h] of sizes) {
      const hole = holeFor(w, h);
      const lead = layoutSignWall(terms(13), { width: w, height: h, hole }).find((b) => b.key === "t0");
      expect(lead).toBeDefined();
      if (!lead) continue;
      const near = (a: number, b: number) => Math.abs(a - b) < 10;
      const side =
        (near(lead.x + lead.width, hole.x) || near(lead.x, hole.x + hole.width)) && lead.height > hole.height - 12;
      const above =
        (near(lead.y + lead.height, hole.y) || near(lead.y, hole.y + hole.height)) && lead.width > hole.width - 12;
      expect(side || above).toBe(true);
      expect(Math.max(lead.width / lead.height, lead.height / lead.width)).toBeLessThan(3.2);
    }
  });

  it("FR-149: board area grows with mentions (largest phrase gets the largest board)", () => {
    const out = layoutSignWall(terms(13), { width: 1366, height: 768, hole: holeFor(1366, 768) });
    const area = (k: string) => {
      const b = out.find((x) => x.key === k);
      return b ? b.width * b.height : 0;
    };
    expect(area("t0")).toBeGreaterThan(area("t6"));
    expect(area("t6")).toBeGreaterThan(area("t12") * 0.99);
  });
});

/** Deterministic pseudo-random totals (LCG), so the fixture never changes. */
const seeded = (n: number) => {
  let seed = 7;
  return Array.from({ length: n }, (_, i) => {
    seed = (seed * 9301 + 49297) % 233280;
    return { key: `r${i}`, total: Math.floor((seed / 233280) * 400) };
  });
};
const areaOf = (b: BoardRect) => b.width * b.height;

// #334 — wall invariants: no bare wall beyond a seam, #1 the largest board, boards ≥ 72 px a side
describe("layoutSignWall invariants (#334)", () => {
  const sizes: [number, number][] = [
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1920, 1080],
  ];
  const fixtures: [string, { key: string; total: number }[]][] = [
    ["8 phrases", terms(8)],
    ["13 phrases", terms(13)],
    ["20 seeded phrases", seeded(20)],
  ];
  for (const [w, h] of sizes) {
    for (const [name, items] of fixtures) {
      const hole = holeFor(w, h);
      const out = layoutSignWall(items, { width: w, height: h, hole });

      it(`${name} at ${w}×${h}: no bare wall wider than a seam (2 px raster)`, () => {
        const g = WALL_GAP / 2 + 0.5;
        const bare: string[] = [];
        for (let x = 1; x < w; x += 2) {
          for (let y = 1; y < h; y += 2) {
            const onBoard = out.some(
              (b) => x >= b.x - g && x <= b.x + b.width + g && y >= b.y - g && y <= b.y + b.height + g,
            );
            const g2 = WALL_GAP + 1;
            const onSign =
              x >= hole.x - g2 && x <= hole.x + hole.width + g2 && y >= hole.y - g2 && y <= hole.y + hole.height + g2;
            if (!onBoard && !onSign) bare.push(`${x},${y}`);
          }
        }
        expect(bare.slice(0, 5)).toEqual([]);
      });

      it(`${name} at ${w}×${h}: #1 holds the largest board`, () => {
        const lead = [...items].sort((a, b) => b.total - a.total)[0];
        const leadBoard = out.find((b) => b.key === lead?.key);
        expect(leadBoard).toBeDefined();
        if (!leadBoard) return;
        for (const b of out) expect(areaOf(leadBoard)).toBeGreaterThanOrEqual(areaOf(b) - 1);
      });
    }
  }

  // Floor checked on the visible board (after the seam inset): ≥ 72 − gap. Exception (BR-042 wins): 20 phrases on
  // canvases under 1024 px wide cannot all fit at that size, so there only the #270 floor (> 40 px) applies.
  for (const [w, h] of sizes) {
    for (const [name, items] of fixtures) {
      const tight = items.length >= 20 && w < 1024;
      if (tight) continue;
      it(`${name} at ${w}×${h}: every board ≥ 72 px a side (before the seam)`, () => {
        for (const b of layoutSignWall(items, { width: w, height: h, hole: holeFor(w, h) })) {
          expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(72 - WALL_GAP - 0.01);
        }
      });
    }
  }
});

// #334 — phone wall: rows in rank order
describe("phoneWallLayout", () => {
  const named = (n: number) =>
    terms(n).map((t, i) => ({ ...t, name: ["giá vé", "dịch vụ", "check-in", "lightstick concert"][i % 4] ?? "x" }));
  for (const n of [13, 20]) {
    const items = named(n);
    const { rects, height } = phoneWallLayout(items, { width: 390 });

    it(`${n} phrases at 390: reading order (y, then x) is rank order; all shown (BR-042)`, () => {
      const read = [...rects].sort((a, b) => a.y - b.y || a.x - b.x).map((r) => r.key);
      const rank = [...items].map((it, i) => ({ ...it, i })).sort((a, b) => b.total - a.total || a.i - b.i);
      expect(read).toEqual(rank.map((r) => r.key));
      expect(height).toBeGreaterThan(0);
    });

    it(`${n} phrases at 390: #1 full width and 160 px; nothing wider than the screen; phrase ≥ 18 px`, () => {
      const first = rects.find((r) => r.key === "t0");
      expect(first).toMatchObject({ x: WALL_GAP / 2, width: 390 - WALL_GAP });
      expect((first?.height ?? 0) + WALL_GAP).toBe(PHONE_LEAD_H);
      for (const r of rects) {
        expect(r.x + r.width).toBeLessThanOrEqual(390);
        const it = items.find((i) => i.key === r.key);
        expect(phraseFit(it?.name ?? "", r.width, r.height).size).toBeGreaterThanOrEqual(18);
      }
    });

    it(`${n} phrases at 390: an odd last board takes the full row`, () => {
      const last = [...rects].sort((a, b) => a.y - b.y || a.x - b.x).at(-1);
      const sameRow = rects.filter((r) => r.y === last?.y);
      if (sameRow.length === 1) expect(last?.width).toBe(390 - WALL_GAP);
      else expect(sameRow).toHaveLength(2);
    });
  }

  it("returns nothing while unmeasured", () => {
    expect(phoneWallLayout(terms(3), { width: 0 })).toEqual({ rects: [], height: 0 });
  });
});

describe("helpers", () => {
  it("BR-042: 0-mention phrases keep a floor weight", () => {
    const w = boardWeights([
      { key: "a", total: 100 },
      { key: "b", total: 0 },
    ]);
    expect(w).toEqual([100, 100 * MIN_WEIGHT_SHARE]);
  });

  it("regions: four bands around the hole, thin bands dropped", () => {
    expect(regionsAround(1000, 600, null, 6)).toEqual([{ x: 0, y: 0, width: 1000, height: 600, side: "all" }]);
    expect(regionsAround(1000, 600, { x: 300, y: 150, width: 400, height: 300 }, 6)).toHaveLength(4);
    expect(regionsAround(1000, 600, { x: 0, y: 150, width: 1000, height: 300 }, 6)).toHaveLength(2);
  });

  it("squarify tiles the rect exactly", () => {
    const out = squarify(
      [
        { key: "a", area: 6000 },
        { key: "b", area: 3000 },
        { key: "c", area: 1000 },
      ],
      { x: 0, y: 0, width: 100, height: 100 },
    );
    expect(out.reduce((s, b) => s + b.width * b.height, 0)).toBeCloseTo(10000);
  });

  it("phraseFit: quotes on horizontal boards, two lines when that is bigger, vertical only on tall boards", () => {
    expect(phraseFit("giá vé", 600, 120)).toMatchObject({ lines: ['"giá vé"'], vertical: false });
    expect(phraseFit("hoàn tiền", 240, 240).lines).toEqual(['"hoàn', 'tiền"']);
    // Width-bound: condensed caps broken after the hyphen, or stacked — never tiny Bungee.
    const tall = phraseFit("check-in", 110, 380);
    expect(tall.vertical || tall.condensed).toBe(true);
    expect(tall.size).toBeGreaterThanOrEqual(20);
    expect(phraseFit("check-in", 240, 180)).toMatchObject({ lines: ['"check-', 'in"'], condensed: false });
    expect(phraseFit("check-in", 380, 110).vertical).toBe(false);
    // Too narrow to read across: stacked even though the gain is small.
    const narrow = phraseFit("lightstick", 72, 210);
    expect(narrow.vertical || narrow.sideways).toBe(true);
    expect(narrow.size).toBeGreaterThanOrEqual(20);
  });
});
