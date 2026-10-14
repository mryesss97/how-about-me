import type { SentimentResponse, TimeseriesResponse, TopicSentimentResponse } from "@how-about-me/contracts";
import { displayLabel, humanizeLabel, languageLabelVi } from "@/lib/semantics/labels";
import type { LanguageCode, SafetyLevel, SentimentLabel } from "@how-about-me/taxonomy";

/** Pure data helpers for the overview charts (T-100) — kept free of React/Recharts so they are unit-testable. */

export type Interval = "hour" | "day";

export const SENTIMENT_ORDER: readonly SentimentLabel[] = ["positive", "neutral", "negative"];

/** Theme tokens that exist in styles/theme.css; hues match `sentimentBadge` (success / gray / error). */
export { SENTIMENT_COLORS } from "@/features/shared/bubbles/sentiment-style";

const pad = (n: string) => n.padStart(2, "0");

/** Bucket label in the bucketing timezone (never the browser tz): hour → "HH:mm dd/MM", day → "dd/MM". */
export function formatBucket(iso: string, interval: Interval, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("vi-VN", {
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

/** Safety hues match `safetyBadge` (gray / warning / error) — never sentiment colours (BR-017). */
export const SAFETY_COLORS: Record<SafetyLevel, string> = {
  safe: "var(--color-utility-neutral-400)",
  sensitive: "var(--color-utility-yellow-500)",
  severe: "var(--color-utility-red-500)",
};

export { humanizeLabel } from "@/lib/semantics/labels";

export type BarRow<K extends string = string> = { key: K; name: string; count: number; share: number | null };

/** Keeps API order; `other` is always moved last (FR-138). */
export function toBarRows<K extends string>(
  distribution: ReadonlyArray<{ label: K; count: number; share: number | null }>,
  nameFn: (key: K) => string = humanizeLabel,
): BarRow<K>[] {
  const rows = distribution.map((d) => ({ key: d.label, name: nameFn(d.label), count: d.count, share: d.share }));
  return [...rows.filter((r) => r.key !== "other"), ...rows.filter((r) => r.key === "other")];
}

/** Sum of shares — above 1 for multi-label dimensions (topics/intents); never normalised. */
export const sumShares = (rows: readonly BarRow[]) => rows.reduce((s, r) => s + (r.share ?? 0), 0);

/** Display names for language codes (FR-143). */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = languageLabelVi;

/** Language donut colours: distinct utility hues; `other` / `unknown` stay neutral. */
export const LANGUAGE_COLORS: Record<LanguageCode, string> = {
  vi: "var(--color-utility-brand-500)",
  en: "var(--color-utility-blue-500)",
  ko: "var(--color-utility-indigo-500)",
  ja: "var(--color-utility-pink-500)",
  th: "var(--color-utility-orange-500)",
  zh: "var(--color-utility-purple-500)",
  other: "var(--color-utility-neutral-400)",
  unknown: "var(--color-utility-neutral-300)",
};

/** Heatmap cell opacity (FR-144): share within the topic row → 0.08..0.6. Capped so dark text stays AA-readable. */
export const HEATMAP_MIN_OPACITY = 0.08;
export const HEATMAP_MAX_OPACITY = 0.6;
export function heatmapOpacity(share: number | null): number {
  if (share === null || share <= 0) return HEATMAP_MIN_OPACITY;
  return HEATMAP_MIN_OPACITY + Math.min(share, 1) * (HEATMAP_MAX_OPACITY - HEATMAP_MIN_OPACITY);
}

type TopicSentimentRow = TopicSentimentResponse["rows"][number];
export type ContributorRow = BarRow<TopicSentimentRow["topic"]> & { total: number };

/**
 * Negative-topic contributors (FR-144, doc 07 §4): topics with negative > 0, ranked negative desc, then
 * negativeShare desc, then API order. count = negative, share = negativeShare (row denominator = total).
 */
export function toContributorRows(rows: readonly TopicSentimentRow[]): ContributorRow[] {
  return rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.negative > 0)
    .sort((a, b) => b.r.negative - a.r.negative || (b.r.negativeShare ?? 0) - (a.r.negativeShare ?? 0) || a.i - b.i)
    .map(({ r }) => ({
      key: r.topic,
      name: displayLabel("topic", r.topic),
      count: r.negative,
      share: r.negativeShare,
      total: r.total,
    }));
}
