import type { BubblePosition } from "@/features/shared/bubbles/bubble-layout";
import { orbitRings } from "./landing-geometry";

/** Pure balloon layout for the landing page (#262) — no React, unit-testable. */

export type Rect = { x: number; y: number; width: number; height: number };

type Item = { key: string; total: number };
type Opts = {
  width: number;
  height: number;
  /** Areas the balloons must not cover (hero, stats), in canvas px. */
  exclude?: readonly Rect[];
  /** Keep only the N largest balloons (mobile). */
  maxCount?: number;
  /** Largest radius in px; default scales with the viewport. */
  maxR?: number;
  /** Hero + stats block the orbit rings surround (#267); canvas centre while unmeasured. */
  content?: Rect | null;
  /** Mobile uses 2 orbit rings instead of 3 (#267). */
  mobile?: boolean;
};

/** Mobile (< 640 px) cap on balloons, so the hero stays readable. */
export const MOBILE_MAX_BALLOONS = 8;
/** Smallest radius as a share of the largest — 0-mention terms still get a readable balloon (#262). */
export const LANDING_MIN_RADIUS_RATIO = 0.4;
const GAP = 8;
/** Orbs (and their glow) keep this distance from the canvas edges, so none is clipped (#267). */
const EDGE_MARGIN = 16;
const ITERATIONS = 120;
/** Fixed angular offset per ring so orbs on neighbouring rings do not line up (#267). */
const RING_PHASE = 0.9;

const round = (n: number) => Math.round(n * 100) / 100;

function overlapsRect(c: { x: number; y: number; r: number }, rect: Rect, gap = GAP): boolean {
  const nx = Math.min(Math.max(c.x, rect.x), rect.x + rect.width);
  const ny = Math.min(Math.max(c.y, rect.y), rect.y + rect.height);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < (c.r + gap) ** 2;
}

/** Moves a circle out of `rect` through the nearest side. */
function pushOut(c: { x: number; y: number; r: number }, rect: Rect) {
  const options = [
    { d: c.x - (rect.x - c.r - GAP), x: rect.x - c.r - GAP, y: c.y },
    { d: rect.x + rect.width + c.r + GAP - c.x, x: rect.x + rect.width + c.r + GAP, y: c.y },
    { d: c.y - (rect.y - c.r - GAP), x: c.x, y: rect.y - c.r - GAP },
    { d: rect.y + rect.height + c.r + GAP - c.y, x: c.x, y: rect.y + rect.height + c.r + GAP },
  ];
  const best = options.reduce((a, b) => (Math.abs(b.d) < Math.abs(a.d) ? b : a));
  // +1 px so rounding to 2 decimals never lands back on the edge.
  c.x = best.x + Math.sign(best.x - c.x);
  c.y = best.y + Math.sign(best.y - c.y);
}

/** True if the circle fits the canvas and avoids every exclusion rect. */
export function balloonFits(c: { x: number; y: number; r: number }, opts: Opts): boolean {
  const m = EDGE_MARGIN - 0.5; // rounding slack
  if (c.x - c.r < m || c.y - c.r < m || c.x + c.r > opts.width - m || c.y + c.r > opts.height - m) return false;
  return !(opts.exclude ?? []).some((rect) => overlapsRect(c, rect));
}

/** Each retry shrinks every radius by this factor until all balloons fit (#262), down to `MIN_SCALE`. */
const SHRINK = 0.9;
const MIN_SCALE = 0.5;

/**
 * Deterministic balloon layout (#262): r ∝ √total with a floor (`LANDING_MIN_RADIUS_RATIO`), seeded on orbit rings
 * (#267: largest first, inner ring outwards, evenly spaced per ring), then relaxed (pair separation, push out of hero/stats, clamp to canvas). If a balloon still
 * cannot fit, every radius shrinks by `SHRINK` and the layout runs again (down to `MIN_SCALE`), so all configured terms
 * show whenever the canvas has room; only then are leftovers dropped, so the hero and stats are never covered. Same
 * input ⇒ same output. Returns [] while the canvas is unmeasured (width/height 0), so balloons never jump.
 */
export function layoutLandingBalloons(items: readonly Item[], opts: Opts): BubblePosition[] {
  const { width, height } = opts;
  if (items.length === 0 || width <= 0 || height <= 0) return [];
  const kept = opts.maxCount != null ? [...items].sort((a, b) => b.total - a.total).slice(0, opts.maxCount) : items;
  const keptKeys = new Set(kept.map((i) => i.key));
  const ordered = items.filter((i) => keptKeys.has(i.key));
  const baseR = opts.maxR ?? Math.min(width, height) * 0.115;

  let best: BubblePosition[] = [];
  for (let scale = 1; scale >= MIN_SCALE - 1e-9; scale *= SHRINK) {
    const placed = relax(ordered, opts, baseR * scale);
    if (placed.length > best.length) best = placed;
    if (placed.length === ordered.length) break;
  }
  return best;
}

function relax(ordered: readonly Item[], opts: Opts, maxR: number): BubblePosition[] {
  const { width, height } = opts;
  const maxRoot = Math.sqrt(Math.max(...ordered.map((i) => i.total), 1));
  const exclude = opts.exclude ?? [];
  const radii = ordered.map(
    (it) => maxR * Math.max(Math.sqrt(Math.max(it.total, 0)) / maxRoot, LANDING_MIN_RADIUS_RATIO),
  );
  const seeds = orbitSeeds(ordered, radii, opts);
  const circles = ordered.map((it, i) => ({ key: it.key, r: radii[i] ?? 0, ...(seeds[i] ?? { x: 0, y: 0 }) }));

  const clamp = (c: (typeof circles)[number]) => {
    c.x = Math.min(Math.max(c.x, c.r + EDGE_MARGIN), width - c.r - EDGE_MARGIN);
    c.y = Math.min(Math.max(c.y, c.r + EDGE_MARGIN), height - c.r - EDGE_MARGIN);
  };

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const a = circles[i];
        const b = circles[j];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const min = a.r + b.r + GAP / 2;
        if (d >= min) continue;
        if (d === 0) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
    for (const c of circles) {
      for (const rect of exclude) if (overlapsRect(c, rect)) pushOut(c, rect);
      clamp(c);
    }
  }

  // Keep a balloon only if it fits and does not overlap one already kept.
  const out: BubblePosition[] = [];
  for (const c of circles) {
    const p = { key: c.key, x: round(c.x), y: round(c.y), r: round(c.r) };
    if (balloonFits(p, opts) && out.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= o.r + p.r)) out.push(p);
  }
  return out;
}

/** Angular samples per ring when looking for arcs outside the hero/stats (#267). */
const RING_SAMPLES = 96;

/**
 * Orbit seed (#267): items sorted by total desc (ties keep setting order), filled into rings from the inside out.
 * Only the arc of each ring that lies outside every exclusion rect is used (the inner ring mostly runs under the
 * hero); capacity ≈ free arc length / (mean diameter + GAP), the last ring takes the rest. Items are spread evenly
 * over the free samples, starting at the ring phase k·RING_PHASE.
 */
function orbitSeeds(ordered: readonly Item[], radii: readonly number[], opts: Opts): { x: number; y: number }[] {
  const { cx, cy, rings } = orbitRings(opts.width, opts.height, opts.mobile ?? false, opts.content);
  const exclude = opts.exclude ?? [];
  const order = ordered.map((it, i) => ({ i, total: it.total })).sort((a, b) => b.total - a.total || a.i - b.i);
  const meanR = radii.reduce((a, b) => a + b, 0) / Math.max(radii.length, 1);
  const out: { x: number; y: number }[] = [];
  let next = 0;
  rings.forEach((ring, k) => {
    const last = k === rings.length - 1;
    const all = Array.from({ length: RING_SAMPLES }, (_, s) => {
      const a = k * RING_PHASE + (2 * Math.PI * s) / RING_SAMPLES;
      return { x: cx + ring.rx * Math.cos(a), y: cy + ring.ry * Math.sin(a) };
    });
    const free = all.filter((p) => !exclude.some((rect) => overlapsRect({ ...p, r: meanR }, rect)));
    const pts = free.length > 0 ? free : all;
    const arc = (Math.PI * (ring.rx + ring.ry) * pts.length) / RING_SAMPLES;
    const capacity = free.length > 0 ? Math.max(1, Math.floor(arc / (2 * meanR + GAP))) : 0;
    const members = order.slice(next, last ? order.length : next + capacity);
    next += members.length;
    members.forEach((m, j) => {
      out[m.i] = pts[Math.floor((j * pts.length) / members.length)] ?? { x: cx, y: cy };
    });
  });
  return out;
}
