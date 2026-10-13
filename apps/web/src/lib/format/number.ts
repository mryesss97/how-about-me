/**
 * Number formatting for KPI cards — docs/01-product/07-metric-definitions.md §1.
 * Never lets NaN/Infinity reach the screen (FR-133); null means "no data" and renders "—" (BR-032).
 */

export const DASH = "—";
const MINUS = "−";

export type GrowthState = "up" | "down" | "flat" | "new";
export type Direction = "up" | "down" | "flat";

/** |x| below this is "flat" (doc 07 §1.2). */
export const FLAT_THRESHOLD = 0.005;

export function formatCount(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US") : DASH;
}

/** Rate in [0,1] → "12.3%"; null (denominator 0) → "—", never "0%" (BR-032). */
export function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return `${(value * 100).toFixed(1)}%`;
}

function signed(n: number, digits: number, suffix: string): string {
  const abs = Math.abs(n).toFixed(digits);
  if (n > 0) return `+${abs}${suffix}`;
  if (n < 0) return `${MINUS}${abs}${suffix}`;
  return `${abs}${suffix}`;
}

/** Growth as a decimal (0.125 = +12.5%). `new` → "New" (FR-133). */
export function formatGrowth(pct: number | null | undefined, state: GrowthState): string {
  if (state === "new") return "New";
  if (state === "flat") return "0%";
  if (pct == null || !Number.isFinite(pct)) return DASH;
  return signed(pct * 100, 1, "%");
}

export function deltaDirection(diff: number | null | undefined): Direction {
  if (diff == null || !Number.isFinite(diff) || Math.abs(diff) < FLAT_THRESHOLD) return "flat";
  return diff > 0 ? "up" : "down";
}

/** Rate delta in percentage points; null when either side is missing (compare off / no data). */
export function formatRateDelta(
  curr: number | null | undefined,
  prev: number | null | undefined,
): { text: string; direction: Direction } | null {
  if (curr == null || prev == null || !Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  const diff = curr - prev;
  return { text: signed(diff * 100, 1, " pp"), direction: deltaDirection(diff) };
}
