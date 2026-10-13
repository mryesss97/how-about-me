import type { MentionListItem } from "@how-about-me/contracts";
import { csvCell, csvRow } from "./csv";

type Column = {
  header: string;
  value: (item: MentionListItem, analyzedAt: Date | null) => string | null;
  /** Free-text from untrusted sources → CSV formula guard. */
  guard: boolean;
};

const join = (xs: string[]) => xs.join("; ");

/**
 * FR-180 export columns (source §15 + ids). Labels are effective values (override > AI, BR-025), already resolved by
 * `toMentionListItem`. Timestamps are UTC ISO 8601. Sentiment and safety are separate columns (BR-017).
 */
export const MENTIONS_CSV_COLUMNS: readonly Column[] = [
  { header: "post_id", value: (i) => i.id, guard: false },
  { header: "platform_post_id", value: (i) => i.platformPostId, guard: false },
  { header: "permalink", value: (i) => i.permalink, guard: false },
  { header: "username", value: (i) => i.username, guard: true },
  { header: "text", value: (i) => i.text, guard: true },
  { header: "published_at", value: (i) => i.publishedAt, guard: false },
  {
    header: "matched_queries",
    // BR-007: only non-excluded matches; BR-010: soft-deleted queries are still listed.
    value: (i) => join(i.matchedQueries.filter((m) => !m.excludedByTerms).map((m) => m.displayName)),
    guard: true,
  },
  { header: "relevance", value: (i) => i.analysis.relevance?.label ?? null, guard: false },
  { header: "sentiment", value: (i) => i.analysis.sentiment?.label ?? null, guard: false },
  { header: "safety", value: (i) => i.analysis.safety?.level ?? null, guard: false },
  { header: "intents", value: (i) => join(i.analysis.intents.map((x) => x.label)), guard: false },
  { header: "topics", value: (i) => join(i.analysis.topics.map((x) => x.label)), guard: false },
  { header: "language", value: (i) => i.analysis.language, guard: false },
  { header: "summary", value: (i) => i.analysis.summary, guard: true },
  { header: "analyzed_at", value: (_i, at) => (at ? at.toISOString() : null), guard: false },
];

export function mentionsCsvHeader(): string {
  return csvRow(MENTIONS_CSV_COLUMNS.map((c) => c.header));
}

export function toMentionsCsvRow(item: MentionListItem, analyzedAt: Date | null): string {
  return csvRow(MENTIONS_CSV_COLUMNS.map((c) => csvCell(c.value(item, analyzedAt), { guardFormula: c.guard })));
}

/** `mentions-YYYYMMDD-HHmm.csv` in the request timezone (default Asia/Ho_Chi_Minh). */
export function exportFilename(now: Date, timezone = "Asia/Ho_Chi_Minh"): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const p = (t: Intl.DateTimeFormatPartTypes) => parts.find((x) => x.type === t)?.value ?? "00";
  return `mentions-${p("year")}${p("month")}${p("day")}-${p("hour")}${p("minute")}.csv`;
}
