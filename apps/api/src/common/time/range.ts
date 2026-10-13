/** Timezone-aware range helpers used by analytics — docs/01-product/07-metric-definitions.md §0, §5 (ADR-0011). */
import { TZDate } from "@date-fns/tz";
import { MAX_RANGE_DAYS } from "@how-about-me/contracts";
import { format, subDays } from "date-fns";
import { AppError } from "../errors/app.error";

export type Range = { from: Date; to: Date };
export type ResolvedRange = Range & { timezone: string; previous?: Range };

const DAY_MS = 86_400_000;
/** Default window when from/to are omitted — matches FE preset `7d` (api-contract §6). */
export const DEFAULT_RANGE_MS = 7 * DAY_MS;

export function previousPeriod(r: Range): Range {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: new Date(r.from.getTime()) };
}

export function bucketInterval(r: Range): "hour" | "day" {
  return r.to.getTime() - r.from.getTime() <= 48 * 3600 * 1000 ? "hour" : "day";
}

export function rangeDays(r: Range): number {
  return (r.to.getTime() - r.from.getTime()) / DAY_MS;
}

export function isLocalMidnight(date: Date, timezone: string): boolean {
  const d = new TZDate(date.getTime(), timezone);
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

/**
 * FR-141, metric-definitions §5: whole local-day ranges step back by calendar days (DST-safe);
 * any other range steps back by its exact length in ms.
 */
export function previousPeriodInTz(r: Range, timezone: string): Range {
  if (!isLocalMidnight(r.from, timezone) || !isLocalMidnight(r.to, timezone)) return previousPeriod(r);
  // Round absorbs the ±1h of a DST transition inside the range.
  const days = Math.round(rangeDays(r));
  const from = subDays(new TZDate(r.from.getTime(), timezone), days);
  return { from: new Date(from.getTime()), to: new Date(r.from.getTime()) };
}

export type RangeInput = { from?: string; to?: string; timezone?: string; compare?: boolean };

/**
 * Resolves query from/to/timezone into a concrete range (api-contract §6):
 * missing both → [now − 7×24h, now); only one → the other is derived ±7×24h.
 * Re-checks `to > from` and span ≤ MAX_RANGE_DAYS after derivation.
 */
export function resolveRange(input: RangeInput, ctx: { projectTimezone: string; now: Date }): ResolvedRange {
  const timezone = input.timezone ?? ctx.projectTimezone;
  const givenFrom = input.from ? new Date(input.from) : undefined;
  const givenTo = input.to ? new Date(input.to) : givenFrom ? undefined : ctx.now;
  const from = givenFrom ?? new Date((givenTo ?? ctx.now).getTime() - DEFAULT_RANGE_MS);
  const to = givenTo ?? new Date(from.getTime() + DEFAULT_RANGE_MS);
  const range = { from, to };
  if (to.getTime() <= from.getTime()) throw new AppError("VALIDATION_ERROR", "to must be after from");
  if (rangeDays(range) > MAX_RANGE_DAYS)
    throw new AppError("VALIDATION_ERROR", `Range must not exceed ${MAX_RANGE_DAYS} days`);
  return { ...range, timezone, ...(input.compare ? { previous: previousPeriodInTz(range, timezone) } : {}) };
}

/** ISO 8601 with the timezone's offset, e.g. `2026-09-04T00:00:00+07:00` (ms only when non-zero). */
export function formatInTz(date: Date, timezone: string): string {
  const d = new TZDate(date.getTime(), timezone);
  return format(d, d.getMilliseconds() ? "yyyy-MM-dd'T'HH:mm:ss.SSSxxx" : "yyyy-MM-dd'T'HH:mm:ssxxx");
}

export function toRangeDto(r: Range, timezone: string): { from: string; to: string } {
  return { from: formatInTz(r.from, timezone), to: formatInTz(r.to, timezone) };
}
