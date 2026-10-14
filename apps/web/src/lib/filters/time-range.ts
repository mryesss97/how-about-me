import { type CalendarDate, fromDate, parseDate, toCalendarDate, toZoned } from "@internationalized/date";
import { MAX_RANGE_DAYS } from "@how-about-me/contracts";
import type { Filters, Preset } from "./schema";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export const PRESET_DURATION_MS: Record<Exclude<Preset, "custom">, number> = {
  "1h": HOUR_MS,
  "24h": 24 * HOUR_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
};

export interface IsoRange {
  from: string;
  to: string;
}

/**
 * Resolves the effective UTC range (FR-131). Relative presets slide with `now`;
 * custom uses the stored instants and falls back to 7d when incomplete.
 */
export function resolveRange(filters: Pick<Filters, "preset" | "from" | "to">, now: Date = new Date()): IsoRange {
  if (filters.preset === "custom" && filters.from && filters.to) {
    return { from: filters.from.toISOString(), to: filters.to.toISOString() };
  }
  const preset = filters.preset === "custom" ? "7d" : filters.preset;
  return { from: new Date(now.getTime() - PRESET_DURATION_MS[preset]).toISOString(), to: now.toISOString() };
}

/**
 * Calendar days (inclusive, `YYYY-MM-DD`) in `tz` → instants: `from` = 00:00 of start day,
 * `to` = 00:00 of the day after end day. Uses the selected tz, never the browser tz.
 */
export function calendarRangeToInstants(start: string | CalendarDate, end: string | CalendarDate, tz: string) {
  const s = typeof start === "string" ? parseDate(start) : start;
  const e = typeof end === "string" ? parseDate(end) : end;
  return { from: toZoned(s, tz).toDate(), to: toZoned(e.add({ days: 1 }), tz).toDate() };
}

/** Inverse of `calendarRangeToInstants`, for showing the stored range in the picker. */
export function instantsToCalendarRange(from: Date, to: Date, tz: string) {
  return {
    start: toCalendarDate(fromDate(from, tz)),
    end: toCalendarDate(fromDate(new Date(to.getTime() - 1), tz)),
  };
}

/** True when `d` is exactly 00:00 local time in `tz`. */
function isLocalMidnight(d: Date, tz: string): boolean {
  const midnight = toZoned(toCalendarDate(fromDate(d, tz)), tz).toDate();
  return midnight.getTime() === d.getTime();
}

/**
 * URL patch for a timezone change — UX §2.1, #240: keep calendar dates, not instants.
 * A custom range picked by calendar days (both ends at 00:00 in the old tz) is re-read as
 * `[from 00:00, to+1 00:00)` in `nextTz`. Exact-instant ranges (e.g. hour drill-down, FR-142)
 * and relative presets only change `tz`. Returned as one patch so the URL updates atomically.
 */
export function timezoneChangePatch(
  filters: Pick<Filters, "preset" | "from" | "to" | "tz">,
  nextTz: string,
): Partial<Filters> {
  if (nextTz === filters.tz) return {};
  const { preset, from, to, tz } = filters;
  if (preset !== "custom" || !from || !to || !isLocalMidnight(from, tz) || !isLocalMidnight(to, tz)) {
    return { tz: nextTz };
  }
  const { start, end } = instantsToCalendarRange(from, to, tz);
  return { tz: nextTz, ...calendarRangeToInstants(start, end, nextTz) };
}

/** TC-DASH-003: `to > from` and span ≤ MAX_RANGE_DAYS. Returns a UI message or null. */
export function validateRange(from: Date, to: Date): string | null {
  const span = to.getTime() - from.getTime();
  if (span <= 0) return "End must be after start";
  if (span > MAX_RANGE_DAYS * DAY_MS) return `Range must not exceed ${MAX_RANGE_DAYS} days`;
  return null;
}

/** Display-only mirror of FR-135: hour buckets up to 48h, else day. The API decides the real interval. */
export function expectedInterval(from: Date, to: Date): "hour" | "day" {
  return to.getTime() - from.getTime() <= 48 * HOUR_MS ? "hour" : "day";
}

/** Floors to the minute so relative-preset query keys stay stable between renders. */
export function floorToMinute(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000);
}
