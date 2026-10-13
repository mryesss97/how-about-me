import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import { packSiblings } from "d3-hierarchy";
import { humanizeLabel } from "./chart-data";

/** Pure data + layout helpers for the sentiment bubble map (#222) — no React, unit-testable. */

type Row = TopicSentimentResponse["rows"][number];

export type BubbleDatum = {
  key: TopicLabel;
  name: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  dominant: SentimentLabel;
  dominantShare: number;
};

/** Tie-break when counts are equal: risk first (negative > positive > neutral), doc 07 §3 (#222). */
export const DOMINANT_TIE_ORDER: readonly SentimentLabel[] = ["negative", "positive", "neutral"];

/** FR-144, doc 07 §3 (#222): argmax sentiment and its share of the row total; null when total = 0 (BR-032). */
export function dominantSentiment(
  row: Pick<Row, "positive" | "neutral" | "negative" | "total">,
): { dominant: SentimentLabel; share: number } | null {
  if (row.total <= 0) return null;
  let dominant: SentimentLabel = "negative";
  for (const s of DOMINANT_TIE_ORDER) if (row[s] > row[dominant]) dominant = s;
  return { dominant, share: row[dominant] / row.total };
}

/** Drops topics with no sentiment (no bubble, BR-032) and keeps API order (total DESC, `other` last). */
export function toBubbleData(rows: readonly Row[]): BubbleDatum[] {
  return rows.flatMap((r) => {
    const d = dominantSentiment(r);
    if (!d) return [];
    return [
      {
        key: r.topic,
        name: humanizeLabel(r.topic),
        positive: r.positive,
        neutral: r.neutral,
        negative: r.negative,
        total: r.total,
        dominant: d.dominant,
        dominantShare: d.share,
      },
    ];
  });
}

/** Tint level of the bubble body: dominant share [1/3, 1] → [0.1, 0.4]; light so dark text stays AA. */
export const BUBBLE_MIN_MIX = 0.1;
export const BUBBLE_MAX_MIX = 0.4;
export function bubbleIntensity(share: number): number {
  const t = Math.min(Math.max((share - 1 / 3) / (2 / 3), 0), 1);
  return BUBBLE_MIN_MIX + t * (BUBBLE_MAX_MIX - BUBBLE_MIN_MIX);
}

export type BubbleFilter = "all" | SentimentLabel;

export function filterBubbles(data: readonly BubbleDatum[], filter: BubbleFilter): BubbleDatum[] {
  return filter === "all" ? [...data] : data.filter((d) => d.dominant === filter);
}

export type BubblePosition = { key: string; x: number; y: number; r: number };

export const FALLBACK_WIDTH = 480;
export const FALLBACK_HEIGHT = 360;
/** Radius floor as a share of the largest radius, so tiny topics stay clickable and labelled (doc 07 §3). */
export const MIN_RADIUS_RATIO = 0.25;
/** Horizontal centre stretch cap — fills wide canvases without scattering the cluster. */
const MAX_STRETCH = 1.6;
/** Packing works in units where the largest radius is 100, so `padding` does not depend on the counts. */
const UNIT = 100;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Deterministic circle packing (#222): area ∝ total (r ∝ √total), with a minimum radius so tiny topics stay
 * clickable. The packed cluster's bounding box is fitted to the canvas with one uniform scale (area ratios kept);
 * centres are then stretched horizontally (factor ≥ 1), which only increases distances, so circles never overlap.
 * Same input ⇒ same output (d3-hierarchy ≥ 3.1.2 is deterministic).
 */
export function layoutBubbles(
  items: ReadonlyArray<{ key: string; total: number }>,
  opts: { width: number; height: number; padding?: number; minRadiusRatio?: number; margin?: number },
): BubblePosition[] {
  if (items.length === 0) return [];
  const width = opts.width > 0 ? opts.width : FALLBACK_WIDTH;
  const height = opts.height > 0 ? opts.height : FALLBACK_HEIGHT;
  const padding = opts.padding ?? 5;
  const minRatio = opts.minRadiusRatio ?? MIN_RADIUS_RATIO;
  const margin = opts.margin ?? 8;

  const maxRoot = Math.sqrt(Math.max(...items.map((i) => i.total), 1));
  const raw = items.map((i) => (Math.max(Math.sqrt(Math.max(i.total, 0)), minRatio * maxRoot) / maxRoot) * UNIT);
  const circles = raw.map((r) => ({ r: r + padding / 2, raw: r, x: 0, y: 0 }));
  packSiblings(circles);

  // Bounding box of the drawn circles (without padding), centred on the canvas.
  const minX = Math.min(...circles.map((c) => c.x - c.raw));
  const maxX = Math.max(...circles.map((c) => c.x + c.raw));
  const minY = Math.min(...circles.map((c) => c.y - c.raw));
  const maxY = Math.max(...circles.map((c) => c.y + c.raw));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const halfW = width / 2 - margin;
  const halfH = height / 2 - margin;
  const k = Math.min(halfW / ((maxX - minX) / 2), halfH / ((maxY - minY) / 2));

  // Largest stretch that keeps every circle inside the canvas horizontally.
  let stretch = MAX_STRETCH;
  for (const c of circles) {
    const dx = Math.abs(c.x - cx) * k;
    if (dx > 0) stretch = Math.min(stretch, (halfW - c.raw * k) / dx);
  }
  stretch = Math.max(stretch, 1);

  return circles.map((c, i) => ({
    key: items[i]?.key ?? "",
    x: round(width / 2 + (c.x - cx) * k * stretch),
    y: round(height / 2 + (c.y - cy) * k),
    r: round(c.raw * k),
  }));
}
