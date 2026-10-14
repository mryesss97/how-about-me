/**
 * Pure layout of the landing signboard wall (#271) — no React, unit-testable.
 *
 * Every configured phrase becomes a rectangular board; board area ∝ mentions (with a floor so quiet or 0-mention
 * phrases stay legible). Boards are packed as a squarified treemap into the regions around the main sign (`hole`),
 * so every phrase renders at every canvas size (#270) and nothing covers the main sign. Same input ⇒ same output.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type BoardRect = { key: string; x: number; y: number; width: number; height: number };

type Item = { key: string; total: number };
type Opts = {
  width: number;
  height: number;
  /** The main sign, in canvas px; boards fill the four regions around it. */
  hole?: Rect | null;
  /** Seam between boards and around the hole, in px. */
  gap?: number;
};

/** Seam between boards — the wall showing through (#271). */
export const WALL_GAP = 6;
/** Smallest board weight as a share of the largest, so quiet or unmentioned phrases stay readable. */
export const MIN_WEIGHT_SHARE = 0.22;
/** Bands thinner than this (px) get proportionally fewer boards. */
const NARROW = 180;
/** Regions thinner than this (px) are not used for boards. */
const MIN_REGION = 72;

/** Board weights: mentions with a floor of `MIN_WEIGHT_SHARE` × the largest. */
export function boardWeights(items: readonly Item[]): number[] {
  const max = Math.max(1, ...items.map((i) => Math.max(i.total, 0)));
  return items.map((i) => Math.max(Math.max(i.total, 0), max * MIN_WEIGHT_SHARE));
}

export type Region = Rect & { side: "top" | "left" | "right" | "bottom" | "all" };

/** The four bands around the hole (top and bottom span the full width), dropping bands too thin to hold a board. */
export function regionsAround(width: number, height: number, hole: Rect | null | undefined, gap: number): Region[] {
  if (!hole) return [{ x: 0, y: 0, width, height, side: "all" }];
  const right = hole.x + hole.width;
  const bottom = hole.y + hole.height;
  const bands: Region[] = [
    { x: 0, y: 0, width, height: hole.y - gap, side: "top" },
    { x: 0, y: hole.y, width: hole.x - gap, height: hole.height, side: "left" },
    { x: right + gap, y: hole.y, width: width - right - gap, height: hole.height, side: "right" },
    { x: 0, y: bottom + gap, width, height: height - bottom - gap, side: "bottom" },
  ];
  return bands.filter((r) => r.width >= MIN_REGION && r.height >= MIN_REGION);
}

type Cell = { key: string; area: number };

const worst = (row: Cell[], side: number): number => {
  const sum = row.reduce((s, c) => s + c.area, 0);
  const max = Math.max(...row.map((c) => c.area));
  const min = Math.min(...row.map((c) => c.area));
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
};

/** Squarified treemap (Bruls et al.): cells (areas already scaled to the rect) laid out largest first. */
export function squarify(cells: readonly Cell[], rect: Rect): BoardRect[] {
  const out: BoardRect[] = [];
  let free = { ...rect };
  let rest = [...cells];
  while (rest.length > 0) {
    const side = Math.min(free.width, free.height);
    const row: Cell[] = [];
    while (rest.length > 0) {
      const next = rest[0] as Cell;
      if (row.length === 0 || worst([...row, next], side) <= worst(row, side)) {
        row.push(next);
        rest = rest.slice(1);
      } else break;
    }
    const sum = row.reduce((s, c) => s + c.area, 0);
    if (free.width >= free.height) {
      // Column along the left edge.
      const w = free.height > 0 ? sum / free.height : 0;
      let y = free.y;
      for (const c of row) {
        const h = w > 0 ? c.area / w : 0;
        out.push({ key: c.key, x: free.x, y, width: w, height: h });
        y += h;
      }
      free = { x: free.x + w, y: free.y, width: free.width - w, height: free.height };
    } else {
      // Row along the top edge.
      const h = free.width > 0 ? sum / free.width : 0;
      let x = free.x;
      for (const c of row) {
        const w = h > 0 ? c.area / h : 0;
        out.push({ key: c.key, x, y: free.y, width: w, height: h });
        x += w;
      }
      free = { x: free.x, y: free.y + h, width: free.width, height: free.height - h };
    }
  }
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Width share of a side band the lead board may take, so the rest of the band still holds boards. */
const LEAD_MAX_SHARE = 0.72;
/** #1 may grow past its mention share so it never reads as a sliver (aspect ≤ this where the band allows). */
const LEAD_MAX_ASPECT = 2.4;

/**
 * Boards for every item. With a main sign, the largest phrase (#1) hangs against it, sharing a full edge (beside it,
 * or above/below it when the side bands are too narrow); the other items (largest weight first) are dealt to the band whose load per area stays lowest,
 * each band is squarified, then every board is inset by half a seam. Returns [] while the canvas is unmeasured.
 */
export function layoutSignWall(items: readonly Item[], opts: Opts): BoardRect[] {
  const { width, height } = opts;
  const gap = opts.gap ?? WALL_GAP;
  if (items.length === 0 || width <= 0 || height <= 0) return [];
  let regions: Rect[] = regionsAround(width, height, opts.hole, gap);
  if (regions.length === 0) return [];

  const weights = boardWeights(items);
  let order = items
    .map((it, i) => ({ key: it.key, weight: weights[i] ?? 0, i }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  const total = order.reduce((s, o) => s + o.weight, 0);
  const rawArea = regions.reduce((s, r) => s + r.width * r.height, 0);

  const placed: BoardRect[] = [];
  const lead = order[0];
  const hole = opts.hole;
  if (lead && hole && order.length > 1) {
    const leadArea = (lead.weight / total) * rawArea;
    // Candidate strips sharing a full edge with the main sign: the whole side band height, or the sign's width
    // above/below it. The strip closest to square wins (sides on ties), so #1 never becomes a sliver.
    const options = (regions as Region[]).flatMap((band) => {
      if (band.side === "left" || band.side === "right") {
        let w = Math.min(
          Math.max(leadArea / band.height, band.height / LEAD_MAX_ASPECT, MIN_REGION),
          band.width * LEAD_MAX_SHARE,
        );
        // A remainder too thin for a board would show bare wall: #1 takes the whole band instead.
        if (band.width - w < MIN_REGION) w = band.width;
        const x = band.side === "left" ? band.x + band.width - w : band.x;
        const rest: Rect[] = [
          { x: band.side === "left" ? band.x : band.x + w, y: band.y, width: band.width - w, height: band.height },
        ];
        return [{ band, lead: { x, y: band.y, width: w, height: band.height }, rest }];
      }
      if (band.side === "top" || band.side === "bottom") {
        const h = Math.min(
          Math.max(leadArea / hole.width, hole.width / LEAD_MAX_ASPECT, MIN_REGION),
          band.height * LEAD_MAX_SHARE,
        );
        const y = band.side === "top" ? band.y + band.height - h : band.y;
        // Side pieces too thin for a board are absorbed by #1 rather than left as bare wall.
        const left = hole.x - band.x < MIN_REGION ? band.x : hole.x;
        const right =
          band.x + band.width - (hole.x + hole.width) < MIN_REGION ? band.x + band.width : hole.x + hole.width;
        const rest: Rect[] = [
          { x: band.x, y, width: left - band.x, height: h },
          { x: right, y, width: band.x + band.width - right, height: h },
          { x: band.x, y: band.side === "top" ? band.y : band.y + h, width: band.width, height: band.height - h },
        ];
        return [{ band, lead: { x: left, y, width: right - left, height: h }, rest }];
      }
      return [];
    });
    const aspect = (r: Rect) => Math.max(r.width / r.height, r.height / r.width);
    const pick = options.reduce<(typeof options)[number] | null>((a, b) => {
      if (!a) return b;
      const side = (o: typeof b) => (o.band.side === "left" || o.band.side === "right" ? 0 : 0.15);
      return aspect(b.lead) + side(b) < aspect(a.lead) + side(a) - 1e-9 ? b : a;
    }, null);
    if (pick) {
      placed.push({ key: lead.key, ...pick.lead });
      const keep = pick.rest.filter((r) => r.width >= MIN_REGION && r.height >= MIN_REGION);
      regions = regions.flatMap((r) => (r !== pick.band ? [r] : keep));
      order = order.slice(1);
    }
  }

  // Narrow bands (beside the main sign on tablets) hold fewer, larger boards: discount their area by thinness.
  const area = regions.map(
    (r) => r.width * r.height * Math.min(1, Math.max(0.3, Math.min(r.width, r.height) / NARROW)),
  );
  const load = regions.map(() => 0);
  const members: (typeof order)[] = regions.map(() => []);
  const restTotal = order.reduce((s, o) => s + o.weight, 0) || 1;
  const totalArea = area.reduce((s, a) => s + a, 0) || 1;
  for (const o of order) {
    let best = 0;
    let bestScore = Infinity;
    regions.forEach((_, r) => {
      // Load share after adding this item, relative to the region's share of the wall.
      const score = ((load[r] ?? 0) + o.weight) / restTotal / ((area[r] ?? 1) / totalArea);
      if (score < bestScore - 1e-9) {
        bestScore = score;
        best = r;
      }
    });
    load[best] = (load[best] ?? 0) + o.weight;
    members[best]?.push(o);
  }

  regions.forEach((region, r) => {
    const list = members[r] ?? [];
    const sum = list.reduce((s, o) => s + o.weight, 0);
    if (list.length === 0 || sum <= 0) return;
    const scale = (region.width * region.height) / sum;
    placed.push(
      ...squarify(
        list.map((o) => ({ key: o.key, area: o.weight * scale })),
        region,
      ),
    );
  });
  return placed.map((b) => ({
    key: b.key,
    x: round(b.x + gap / 2),
    y: round(b.y + gap / 2),
    width: round(Math.max(b.width - gap, 0)),
    height: round(Math.max(b.height - gap, 0)),
  }));
}

/** Height of the phone wall (#271): rows of about two boards, each ~ `rowHeight` tall. */
export function phoneWallHeight(count: number, rowHeight = 128): number {
  return Math.max(rowHeight * 2, Math.ceil(count / 2) * rowHeight);
}

/** Vertical lettering must beat horizontal by this factor and reach this size (px). */
const VERTICAL_GAIN = 1.2;
const VERTICAL_MIN = 18;
/** Horizontal lettering below this size (px) is not readable on a wall. */
const UNREADABLE = 15;
/** Condensed caps take over when they read this much bigger than Bungee (narrow, width-bound boards). */
const CONDENSED_GAIN = 1.3;

/** Faces: Bungee (wide sign caps) and Saira Extra Condensed 700 caps (hand-ruled condensed sign lettering). */
const FACES = {
  sign: { em: 0.74, lh: 1.2 },
  condensed: { em: 0.43, lh: 1.05 },
} as const;

export type PhraseFit = {
  size: number;
  lines: string[];
  vertical: boolean;
  /** Set in the condensed sign face instead of Bungee. */
  condensed: boolean;
  /** Condensed caps turned 90° along a tall, narrow board (a blade sign read top to bottom). */
  sideways?: boolean;
};

/** Best two-line break: at a space or right after a hyphen ("CHECK-" / "IN"), longest line as short as possible. */
function bestBreak(text: string): { lines: string[]; longest: number } | null {
  let best: { lines: string[]; longest: number } | null = null;
  for (let i = 1; i < text.length - 1; i++) {
    const ch = text[i];
    const cut =
      ch === " "
        ? [text.slice(0, i), text.slice(i + 1)]
        : ch === "-"
          ? [text.slice(0, i + 1), text.slice(i + 1)]
          : null;
    const [a = "", b = ""] = cut ?? [];
    if (!cut || !a.trim() || !b.trim()) continue;
    const longest = Math.max(a.length, b.length);
    if (!best || longest < best.longest) best = { lines: [a, b], longest };
  }
  return best;
}

/**
 * Phrase type for a board (#271): the largest of one line or a two-line break, in Bungee or — when the board is
 * width-bound — in condensed caps; on tall, narrow boards the letters may stack top to bottom like a vertical shop
 * sign (one column per word group; the straight quotes are dropped there, upright quote glyphs read as noise).
 * `reserveTop` keeps the rank plate clear of the first line.
 */
export function phraseFit(name: string, width: number, height: number, reserveTop = 0): PhraseFit {
  const pad = Math.max(10, Math.min(width, height) * 0.1);
  const innerW = Math.max(width - 2 * pad, 1);
  const innerH = Math.max(height - 2 * pad - reserveTop, 1);
  const quoted = `"${name}"`;
  const split = bestBreak(quoted);
  const candidates: PhraseFit[] = [];
  for (const [face, f] of Object.entries(FACES) as [keyof typeof FACES, (typeof FACES)[keyof typeof FACES]][]) {
    const condensed = face === "condensed";
    // Text may take ~62% of the inner height; the rest is the share figure and air.
    candidates.push({
      size: Math.min((innerH * 0.62) / f.lh, height * 0.34, innerW / (quoted.length * f.em)),
      lines: [quoted],
      vertical: false,
      condensed,
    });
    if (split) {
      candidates.push({
        size: Math.min((innerH * 0.62) / (2 * f.lh), innerW / (split.longest * f.em)),
        lines: split.lines,
        vertical: false,
        condensed,
      });
    }
  }
  const best = (list: PhraseFit[]) => list.reduce((a, b) => (b.size > a.size * 1.08 ? b : a));
  const sign = best(candidates.filter((c) => !c.condensed));
  const cond = best(candidates.filter((c) => c.condensed));
  let pick = cond.size >= sign.size * CONDENSED_GAIN ? cond : sign;

  if (height >= width * 1.3) {
    const plain = name.split(" ").filter(Boolean);
    const cols =
      plain.length > 1
        ? (bestBreak(name) ?? { lines: [name], longest: name.length })
        : { lines: [name], longest: name.length };
    // Upright stacked glyphs advance ~1.06 em; columns need ~1.25 em each. Keep ~22% of the height for the figure.
    const size = Math.min(innerW / (cols.lines.length * 1.25), (innerH * 0.78) / (cols.longest * 1.06));
    if ((size >= pick.size * VERTICAL_GAIN && size >= VERTICAL_MIN) || (pick.size < UNREADABLE && size > pick.size)) {
      pick = { size, lines: cols.lines, vertical: true, condensed: false };
    }
    // Blade sign: the quoted phrase in condensed caps turned along the board's length.
    const blade = Math.min((innerW * 0.7) / FACES.condensed.lh, (innerH * 0.92) / (quoted.length * FACES.condensed.em));
    if (blade >= pick.size * VERTICAL_GAIN) {
      pick = { size: blade, lines: [quoted], vertical: false, condensed: true, sideways: true };
    }
  }
  return { ...pick, size: Math.round(Math.max(11, Math.min(pick.size, 76))) };
}
