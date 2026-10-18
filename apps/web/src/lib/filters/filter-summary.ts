import { DEFAULT_TZ } from "./parsers";
import { DEFAULT_PRESET, DEFAULT_RELEVANCE, type Filters } from "./schema";
import { resolveRange } from "./time-range";
import { tzLabel } from "@/lib/time/format";

/** Filters that live in "Bộ lọc khác (n)" — UX §2.1, #332. BR-017: sentiment and safety stay separate. */
export const SECONDARY_FILTER_KEYS = ["sentiment", "safety", "intent", "topic", "language", "analysisStatus"] as const;

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v));

/** n in "Bộ lọc khác (n)": selected values (not keys, so it matches the chips) + 1 when tz ≠ default. */
export function secondaryFilterCount(filters: Filters): number {
  const values = SECONDARY_FILTER_KEYS.reduce((sum, k) => sum + filters[k].length, 0);
  return values + (filters.tz !== DEFAULT_TZ ? 1 : 0);
}

/** n in the mobile strip "n bộ lọc": every non-default filter except time (#332). */
export function activeFilterCount(filters: Filters): number {
  // BR-016: default relevance [relevant] is not a filter the user applied.
  const relevance = sameSet(filters.relevance, DEFAULT_RELEVANCE) ? 0 : filters.relevance.length;
  return (
    secondaryFilterCount(filters) +
    filters.queryIds.length +
    relevance +
    filters.phrase.length +
    (filters.term ? 1 : 0) +
    (filters.compare ? 1 : 0)
  );
}

/** True when nothing differs from the defaults, so "Đặt lại" is hidden. `q`/`sort` belong to the Mentions toolbar. */
export function isDefaultFilters(filters: Filters): boolean {
  return (
    filters.preset === DEFAULT_PRESET &&
    filters.from === null &&
    filters.to === null &&
    activeFilterCount(filters) === 0
  );
}

const DAY_FMT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
const HOUR_FMT: Intl.DateTimeFormatOptions = { ...DAY_FMT, hour: "2-digit", minute: "2-digit", hourCycle: "h23" };

function fmt(d: Date, timeZone: string, opts: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, ...opts }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = `${get("day")}/${get("month")}`;
  return opts.hour ? `${get("hour")}:${get("minute")} ${day}` : day;
}

/**
 * Effective range as text in `filters.tz` (never the browser tz): `12/10 – 19/10`, hours for 1h/24h.
 * Custom `to` is exclusive (next midnight), so the last shown day is `to − 1 ms`. GMT suffix only when tz ≠ default.
 */
export function rangeLabel(filters: Filters, now: Date = new Date()): string {
  const { from, to } = resolveRange(filters, now);
  const hourly = filters.preset === "1h" || filters.preset === "24h";
  const opts = hourly ? HOUR_FMT : DAY_FMT;
  const end = filters.preset === "custom" ? new Date(new Date(to).getTime() - 1) : new Date(to);
  const text = `${fmt(new Date(from), filters.tz, opts)} – ${fmt(end, filters.tz, opts)}`;
  return filters.tz === DEFAULT_TZ ? text : `${text} · ${tzLabel(filters.tz, end).split(" · ")[0]}`;
}
