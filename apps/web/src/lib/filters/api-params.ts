import { displayLabel } from "@/lib/semantics/labels";
import { serializeFilters } from "./parsers";
import { type ArrayFilterKey, DEFAULT_RELEVANCE, type Filters } from "./schema";
import { resolveRange } from "./time-range";

export type ApiTarget = "analytics" | "mentions";

const ARRAY_KEYS: ArrayFilterKey[] = [
  "queryIds",
  "relevance",
  "sentiment",
  "safety",
  "intent",
  "topic",
  "language",
  "analysisStatus",
  "phrase",
];

/**
 * FE filters → API query params (FR-130). Maps `tz` → `timezone`, drops `preset`, CSV-encodes arrays,
 * omits empty arrays, always sends `relevance` (BR-016), keeps only fields valid for `target`.
 * Keys are sorted so the output is a stable query key.
 */
export function toApiParams(filters: Filters, opts: { target: ApiTarget; now?: Date }): Record<string, string> {
  const { from, to } = resolveRange(filters, opts.now);
  const out: Record<string, string> = { from, to, timezone: filters.tz };
  for (const key of ARRAY_KEYS) {
    const values = filters[key];
    if (values.length > 0) out[key] = values.join(",");
  }
  if (filters.term) out.term = filters.term; // BR-042 (#273)
  if (!out.relevance) out.relevance = DEFAULT_RELEVANCE.join(",");
  if (opts.target === "analytics") {
    if (filters.compare) out.compare = "true";
  } else {
    if (filters.q?.trim()) out.q = filters.q.trim();
    out.sort = filters.sort;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Drill-down link (FR-142): pins the resolved range as `custom` so Mentions shows the same post set; no `compare`. */
export function toMentionsHref(filters: Filters, extra: Partial<Filters> = {}, now: Date = new Date()): string {
  const merged: Filters = { ...filters, ...extra };
  const range = resolveRange(merged, now);
  return `/mentions${serializeFilters({
    ...merged,
    preset: "custom",
    from: new Date(range.from),
    to: new Date(range.to),
    compare: null,
  })}`;
}

/**
 * #250 / FR-148: plain `/mentions?phrase=<p>` link from mention detail (page defaults for range/relevance).
 * The `phrase` parser re-normalises on read (BR-041), so the link always matches.
 */
export function phraseMentionsHref(phrase: string): string {
  return `/mentions${serializeFilters({ phrase: [phrase] })}`;
}

/** #273: `/mentions?term=<t>` link (page defaults for range/relevance); parser re-normalises (BR-041). */
export function termMentionsHref(term: string): string {
  return `/mentions${serializeFilters({ term })}`;
}

export type ChipKey = ArrayFilterKey | "term";

export interface AppliedChip {
  key: ChipKey;
  value: string;
  label: string;
}

const LABEL_PREFIX: Record<ArrayFilterKey, string> = {
  queryIds: "Truy vấn",
  relevance: "Mức liên quan",
  sentiment: "Cảm xúc",
  safety: "An toàn",
  intent: "Ý định",
  topic: "Chủ đề",
  language: "Ngôn ngữ",
  analysisStatus: "Trạng thái",
  phrase: "Cụm từ",
};

function valueLabel(key: ArrayFilterKey, value: string, queryNames: Record<string, string>): string {
  switch (key) {
    case "queryIds":
      return queryNames[value] ?? value.slice(0, 8);
    case "phrase":
      return value; // verbatim, no humanising (BR-041)
    default:
      return displayLabel(key, value);
  }
}

/** Chips for active non-default filters (relevance = [relevant] yields no chip, BR-016). */
export function appliedChips(filters: Filters, queryNames: Record<string, string> = {}): AppliedChip[] {
  const isDefaultRelevance = filters.relevance.length === 1 && filters.relevance[0] === "relevant";
  const chips: AppliedChip[] = ARRAY_KEYS.flatMap((key) => {
    if (key === "relevance" && isDefaultRelevance) return [];
    return (filters[key] as string[]).map((value) => ({
      key,
      value,
      label: `${LABEL_PREFIX[key]}: ${valueLabel(key, value, queryNames)}`,
    }));
  });
  // BR-042 (#273): term shown verbatim.
  if (filters.term) chips.push({ key: "term", value: filters.term, label: `Cụm từ: ${filters.term}` });
  return chips;
}

/** Removes one value; emptied relevance falls back to [relevant] (BR-016: empty must not mean "all"). */
export function removeFilterValue(filters: Filters, key: ChipKey, value: string): Partial<Filters> {
  if (key === "term") return { term: null };
  const next = (filters[key] as string[]).filter((v) => v !== value);
  if (key === "relevance" && next.length === 0) return { relevance: [...DEFAULT_RELEVANCE] };
  return { [key]: next } as Partial<Filters>;
}
