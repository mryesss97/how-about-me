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
    // Side bands meet the top/bottom bands edge to edge (#334): the boards' inset alone draws one seam there.
    { x: 0, y: hole.y - gap, width: hole.x - gap, height: hole.height + 2 * gap, side: "left" },
    { x: right + gap, y: hole.y - gap, width: width - right - gap, height: hole.height + 2 * gap, side: "right" },
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

/** Width share of a side band the lead board may take at first; it grows when #1 would not be the largest (#334). */
const LEAD_MAX_SHARE = 0.72;
/** #1 may grow past its mention share so it never reads as a sliver (aspect ≤ this where the band allows). */
const LEAD_MAX_ASPECT = 2.4;
/** Growth steps for #1 until it holds the largest board (#334); the last step gives it the whole band. */
const LEAD_STEPS = [1, 1.25, 1.5, 1.8, 2.2, 2.7, 3.3, 4, Infinity];
/** Bounded passes moving boards out of a band whose boards fall under `MIN_REGION` (#334). */
const MIN_SIDE_PASSES = 24;

type Ordered = { key: string; weight: number; i: number };
type LeadPick = { band: Region; lead: Rect; rest: Rect[] };

/** Strips for #1 sharing a full edge with the main sign; `scale` grows its area and its share of the band. */
function leadOptions(regions: readonly Region[], hole: Rect, leadArea: number, scale: number): LeadPick[] {
  const share = scale === Infinity ? 1 : Math.min(1, LEAD_MAX_SHARE * Math.sqrt(scale));
  const area = scale === Infinity ? Infinity : leadArea * scale;
  return regions.flatMap((band): LeadPick[] => {
    if (band.side === "left" || band.side === "right") {
      let w = Math.min(Math.max(area / band.height, band.height / LEAD_MAX_ASPECT, MIN_REGION), band.width * share);
      // A remainder too thin for a board would show bare wall: #1 takes the whole band instead.
      if (band.width - w < MIN_REGION) w = band.width;
      const x = band.side === "left" ? band.x + band.width - w : band.x;
      const rest: Rect[] = [
        { x: band.side === "left" ? band.x : band.x + w, y: band.y, width: band.width - w, height: band.height },
      ];
      return [{ band, lead: { x, y: band.y, width: w, height: band.height }, rest }];
    }
    if (band.side === "top" || band.side === "bottom") {
      let h = Math.min(Math.max(area / hole.width, hole.width / LEAD_MAX_ASPECT, MIN_REGION), band.height * share);
      if (band.height - h < MIN_REGION) h = band.height;
      const y = band.side === "top" ? band.y + band.height - h : band.y;
      // Side pieces too thin for a board are absorbed by #1 rather than left as bare wall.
      // On the last step #1 takes the band's full width too (few phrases on a large canvas).
      const all = scale === Infinity;
      const left = all || hole.x - band.x < MIN_REGION ? band.x : hole.x;
      const right =
        all || band.x + band.width - (hole.x + hole.width) < MIN_REGION ? band.x + band.width : hole.x + hole.width;
      const rest: Rect[] = [
        { x: band.x, y, width: left - band.x, height: h },
        { x: right, y, width: band.x + band.width - right, height: h },
        { x: band.x, y: band.side === "top" ? band.y : band.y + h, width: band.width, height: band.height - h },
      ];
      return [{ band, lead: { x: left, y, width: right - left, height: h }, rest }];
    }
    return [];
  });
}

const aspectOf = (r: Rect) => Math.max(r.width / r.height, r.height / r.width);

/**
 * Deal items (heaviest first) to the region whose load per area stays lowest; then (#334) every region that got
 * nothing takes the lightest board of the fullest region, so no region is left as bare wall.
 */
function deal(order: readonly Ordered[], regions: readonly Rect[]): Ordered[][] {
  // Narrow bands (beside the main sign on tablets) hold fewer, larger boards: discount their area by thinness.
  const area = regions.map(
    (r) => r.width * r.height * Math.min(1, Math.max(0.3, Math.min(r.width, r.height) / NARROW)),
  );
  const load = regions.map(() => 0);
  const members: Ordered[][] = regions.map(() => []);
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
  for (let r = 0; r < members.length; r++) {
    if ((members[r] ?? []).length > 0) continue;
    const donor = fullest(members);
    if (donor < 0) break;
    const moved = members[donor]?.pop();
    if (moved) members[r]?.push(moved);
  }
  return members;
}

/** Index of the region with the most boards (more than one), or -1. */
function fullest(members: readonly Ordered[][]): number {
  let best = -1;
  members.forEach((m, r) => {
    if (m.length > 1 && (best < 0 || m.length > (members[best]?.length ?? 0))) best = r;
  });
  return best;
}

function squarifyAll(regions: readonly Rect[], members: readonly Ordered[][]): BoardRect[][] {
  return regions.map((region, r) => {
    const list = members[r] ?? [];
    const sum = list.reduce((s, o) => s + o.weight, 0);
    if (list.length === 0 || sum <= 0) return [];
    const scale = (region.width * region.height) / sum;
    return squarify(
      list.map((o) => ({ key: o.key, area: o.weight * scale })),
      region,
    );
  });
}

const minSide = (b: Rect) => Math.min(b.width, b.height);

/**
 * #334: while a region holds a board thinner than `MIN_REGION`, move its lightest board to the region with the
 * roomiest boards (bounded, deterministic). When no move helps, every phrase still shows (BR-042 wins).
 */
function enforceMinSide(regions: readonly Rect[], members: Ordered[][]): BoardRect[][] {
  let boards = squarifyAll(regions, members);
  for (let pass = 0; pass < MIN_SIDE_PASSES; pass++) {
    const from = boards.findIndex(
      (list, r) => list.some((b) => minSide(b) < MIN_REGION) && (members[r]?.length ?? 0) > 1,
    );
    if (from < 0) break;
    // Room per board: region area per member after receiving one more.
    let to = -1;
    let room = 0;
    regions.forEach((reg, r) => {
      if (r === from) return;
      const n = (members[r]?.length ?? 0) + 1;
      const per = (reg.width * reg.height) / n;
      if (per > room && Math.sqrt(per) >= MIN_REGION * 1.4) {
        room = per;
        to = r;
      }
    });
    if (to < 0) break;
    const moved = members[from]?.pop();
    if (!moved) break;
    members[to]?.push(moved);
    members[to]?.sort((a, b) => b.weight - a.weight || a.i - b.i);
    const next = squarifyAll(regions, members);
    // Undo a move that made the receiving region worse than the floor.
    if ((next[to] ?? []).some((b) => minSide(b) < MIN_REGION)) {
      members[to] = (members[to] ?? []).filter((o) => o !== moved);
      members[from]?.push(moved);
      break;
    }
    boards = next;
  }
  return boards;
}

/**
 * Boards for every item. With a main sign, the largest phrase (#1) hangs against it, sharing a full edge (beside it,
 * or above/below it when the side bands are too narrow); the other items are dealt to the bands (`deal`), each band
 * is squarified, then every board is inset by half a seam. Invariants (#334): no region is left as bare wall when
 * there are at least as many items as regions, #1 holds the largest board (it grows step by step, up to its whole
 * band), and boards stay ≥ `MIN_REGION` px a side (before the seam inset) where the canvas allows. Returns [] while
 * the canvas is unmeasured.
 */
export function layoutSignWall(items: readonly Item[], opts: Opts): BoardRect[] {
  const { width, height } = opts;
  const gap = opts.gap ?? WALL_GAP;
  if (items.length === 0 || width <= 0 || height <= 0) return [];
  const bands = regionsAround(width, height, opts.hole, gap);
  if (bands.length === 0) return [];

  const weights = boardWeights(items);
  const order: Ordered[] = items
    .map((it, i) => ({ key: it.key, weight: weights[i] ?? 0, i }))
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  const total = order.reduce((s, o) => s + o.weight, 0);
  const rawArea = bands.reduce((s, r) => s + r.width * r.height, 0);

  const lead = order[0];
  const hole = opts.hole;
  if (!lead || !hole || order.length < 2) {
    return inset(enforceMinSide(bands, deal(order, bands)).flat(), gap);
  }
  const leadArea = (lead.weight / total) * rawArea;
  let result: BoardRect[] = [];
  let bestRatio = -Infinity;
  for (const scale of LEAD_STEPS) {
    const options = leadOptions(bands, hole, leadArea, scale);
    if (options.length === 0) return inset(enforceMinSide(bands, deal(order, bands)).flat(), gap);
    // The strip closest to square goes first (sides on ties), so #1 never becomes a sliver; on the last step every
    // band is tried and the one where #1 is largest relative to the others wins.
    const ranked = [...options].sort((a, b) => {
      const side = (o: LeadPick) => (o.band.side === "left" || o.band.side === "right" ? 0 : 0.15);
      return aspectOf(a.lead) + side(a) - (aspectOf(b.lead) + side(b));
    });
    for (const pick of scale === Infinity ? ranked : ranked.slice(0, 1)) {
      const keep = pick.rest.filter((r) => r.width >= MIN_REGION && r.height >= MIN_REGION);
      const regions = bands.flatMap((r) => (r !== pick.band ? [r] : keep));
      const boards = regions.length > 0 ? enforceMinSide(regions, deal(order.slice(1), regions)).flat() : [];
      const leadSize = pick.lead.width * pick.lead.height;
      const ratio = leadSize / Math.max(1e-6, ...boards.map((b) => b.width * b.height));
      if (ratio > bestRatio + 1e-9) {
        bestRatio = ratio;
        result = [{ key: lead.key, ...pick.lead }, ...boards];
      }
      if (ratio >= 1 - 1e-9) return inset(result, gap);
    }
  }
  return inset(result, gap);
}

function inset(placed: readonly BoardRect[], gap: number): BoardRect[] {
  return placed.map((b) => ({
    key: b.key,
    x: round(b.x + gap / 2),
    y: round(b.y + gap / 2),
    width: round(Math.max(b.width - gap, 0)),
    height: round(Math.max(b.height - gap, 0)),
  }));
}

/** Phone wall rows (#334): #1 alone, then ranks 2–3, then the rest. */
export const PHONE_LEAD_H = 160;
export const PHONE_TOP_H = 144;
export const PHONE_ROW_H = 112;
/** A half-width board whose phrase would set smaller than this (px) takes the whole row. */
const PHONE_HALF_MIN = 22;

type PhoneItem = Item & { name?: string };

/**
 * Phone wall (#334): boards in rank order (mentions desc, ties keep setting order — same as the rank plates), read
 * left to right, top to bottom. #1 takes a full row 160 px tall; ranks 2–3 sit in rows of 144 px, the rest 112 px,
 * two to a row. A board whose phrase would set under 22 px at half width, and an odd last board, take the full row.
 * Rects are inset by half a seam like the treemap.
 */
export function phoneWallLayout(
  items: readonly PhoneItem[],
  opts: { width: number; gap?: number },
): { rects: BoardRect[]; height: number } {
  const gap = opts.gap ?? WALL_GAP;
  const { width } = opts;
  if (items.length === 0 || width <= 0) return { rects: [], height: 0 };
  const order = items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => Math.max(b.total, 0) - Math.max(a.total, 0) || a.i - b.i);
  const half = width / 2;
  const rowH = (rank: number) => (rank === 0 ? PHONE_LEAD_H : rank <= 2 ? PHONE_TOP_H : PHONE_ROW_H);
  const full = (it: PhoneItem, rank: number) =>
    rank === 0 || (it.name != null && phraseFit(it.name, half - gap, rowH(rank) - gap).size < PHONE_HALF_MIN);
  const placed: BoardRect[] = [];
  let y = 0;
  let k = 0;
  while (k < order.length) {
    const a = order[k] as PhoneItem;
    const b = order[k + 1];
    const h = rowH(k);
    if (full(a, k) || !b || full(b, k + 1)) {
      placed.push({ key: a.key, x: 0, y, width, height: h });
      k += 1;
    } else {
      placed.push({ key: a.key, x: 0, y, width: half, height: h }, { key: b.key, x: half, y, width: half, height: h });
      k += 2;
    }
    y += h;
  }
  return { rects: inset(placed, gap), height: y };
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
