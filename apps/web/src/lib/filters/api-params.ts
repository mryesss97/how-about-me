import { isUnlabelledStatusFilter } from "@how-about-me/contracts";
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
 * omits empty arrays, always sends `relevance` (BR-016), keeps only fields valid for `target`. For Mentions the server
 * still keeps NULL-relevance posts when the status filter is pending/processing/failed only (BR-016 exception, #328).
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

/** Resolves the range once and pins it as `custom` (FR-142); `range` overrides with an already pinned range. */
export function pinRange(filters: Filters, now: Date = new Date(), range?: { from: string; to: string }): Filters {
  const r = range ?? resolveRange(filters, now);
  return { ...filters, preset: "custom", from: new Date(r.from), to: new Date(r.to) };
}

/** Drill-down link (FR-142): pins the resolved range as `custom` so Mentions shows the same post set; no `compare`. */
export function toMentionsHref(filters: Filters, extra: Partial<Filters> = {}, now: Date = new Date()): string {
  return `/mentions${serializeFilters({ ...pinRange({ ...filters, ...extra }, now), compare: null })}`;
}

/**
 * #349 share link: absolute URL of `pathname` with the range pinned as `custom` so the recipient sees the same
 * post set (FR-142/FR-130). `compare` is kept — it adds a comparison, never changes the set.
 */
export function toShareUrl(
  pathname: string,
  filters: Filters,
  opts: { origin: string; now?: Date; range?: { from: string; to: string } },
): string {
  return `${opts.origin}${pathname}${serializeFilters(pinRange(filters, opts.now, opts.range))}`;
}

/**
 * #250 / FR-148: plain `/mentions?phrase=<p>` link from mention detail (page defaults for range/relevance).
 * The `phrase` parser re-normalises on read (BR-041), so the link always matches.
 */
export function phraseMentionsHref(phrase: string): string {
  return `/mentions${serializeFilters({ phrase: [phrase] })}`;
}

export type ChipKey = ArrayFilterKey | "term";

export interface AppliedChip {
  key: ChipKey;
  value: string;
  label: string;
  /** Info chips explain a server-side rule and have no close button (default true). */
  removable?: boolean;
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

/**
 * Chips for active non-default filters (relevance = [relevant] yields no chip, BR-016). `mentions` adds the
 * BR-016 exception info chip (#328) — analytics never applies that rule.
 */
export function appliedChips(
  filters: Filters,
  queryNames: Record<string, string> = {},
  opts: { mentions?: boolean } = {},
): AppliedChip[] {
  const isDefaultRelevance = filters.relevance.length === 1 && filters.relevance[0] === "relevant";
  const chips: AppliedChip[] = ARRAY_KEYS.flatMap((key) => {
    if (key === "relevance" && isDefaultRelevance) return [];
    return (filters[key] as string[]).map((value) => ({
      key,
      value,
      label: `${LABEL_PREFIX[key]}: ${valueLabel(key, value, queryNames)}`,
    }));
  });
  // BR-016 exception (#328): status-only list also includes posts not analysed yet.
  if (opts.mentions && isUnlabelledStatusFilter(filters.analysisStatus)) {
    chips.push({
      key: "relevance",
      value: "unanalysed",
      label: "Mức liên quan: gồm cả chưa phân tích",
      removable: false,
    });
  }
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
