import type { SentimentResponse, TimeseriesResponse } from "@how-about-me/contracts";
import type { SentimentLabel } from "@how-about-me/taxonomy";

/** Pure data helpers for the overview charts (T-100) — kept free of React/Recharts so they are unit-testable. */

export type Interval = "hour" | "day";

export const SENTIMENT_ORDER: readonly SentimentLabel[] = ["positive", "neutral", "negative"];

/** Theme tokens that exist in styles/theme.css; hues match `sentimentBadge` (success / gray / error). */
export const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  positive: "var(--color-utility-green-500)",
  neutral: "var(--color-utility-neutral-400)",
  negative: "var(--color-utility-red-500)",
};

const pad = (n: string) => n.padStart(2, "0");

/** Bucket label in the bucketing timezone (never the browser tz): hour → "HH:mm dd/MM", day → "dd/MM". */
export function formatBucket(iso: string, interval: Interval, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => pad(parts.find((p) => p.type === type)?.value ?? "");
  const date = `${get("day")}/${get("month")}`;
  return interval === "hour" ? `${get("hour")}:${get("minute")} ${date}` : date;
}

/** Bucket [from, to) — start + 1h / 1d. Used by drill-down (T-102). */
export function bucketRange(time: string, interval: Interval): { from: string; to: string } {
  const start = new Date(time);
  const step = interval === "hour" ? 3_600_000 : 86_400_000;
  return { from: start.toISOString(), to: new Date(start.getTime() + step).toISOString() };
}

export type MentionsRow = { time: string; label: string; mentions: number; previous?: number };

export function toMentionsRows(ts: TimeseriesResponse): MentionsRow[] {
  return ts.data.map((d) => ({
    time: d.time,
    label: formatBucket(d.time, ts.interval, ts.timezone),
    mentions: d.mentions,
    ...(d.previous === undefined ? {} : { previous: d.previous }),
  }));
}

export const hasPrevious = (rows: readonly MentionsRow[]) => rows.some((r) => r.previous !== undefined);

export type SentimentStackRow = {
  time: string;
  label: string;
  positive: number;
  neutral: number;
  negative: number;
  /** Bucket denominator for tooltip shares. */
  total: number;
};

export function toSentimentStackRows(
  ts: SentimentResponse["timeseries"] | undefined,
  timeZone: string,
): SentimentStackRow[] {
  if (!ts) return [];
  return ts.data.map((d) => ({
    ...d,
    label: formatBucket(d.time, ts.interval, timeZone),
    total: d.positive + d.neutral + d.negative,
  }));
}

/** Share with a zero-safe denominator: null → rendered as "—" (BR-032, never NaN). */
export const shareOf = (count: number, denominator: number): number | null =>
  denominator > 0 ? count / denominator : null;
