/**
 * Analytics foundation (T-090): resolves filters into a scope and builds the shared base set `B`
 * — docs/01-product/07-metric-definitions.md §0, §5. Every analytics widget must start from `base`.
 */
import type { AnalysisFilters, AnalyticsQuery } from "@how-about-me/contracts";
import { LANGUAGE_CODES } from "@how-about-me/taxonomy";
import { Prisma } from "@prisma/client";
import { type Range, resolveRange } from "../../common/time/range";
import { mentionsTermSql, normalizedPostText } from "./term-match";

export type ScopeFilters = Omit<AnalysisFilters, "from" | "to" | "timezone">;
export type AnalyticsScope = { projectId: string; range: Range; timezone: string; filters: ScopeFilters };
export type ResolvedAnalyticsQuery = { scope: AnalyticsScope; previousScope?: AnalyticsScope };

export type IgnorableFilter =
  "relevance" | "sentiment" | "safety" | "language" | "analysisStatus" | "intent" | "topic" | "phrase" | "term";

export function resolveAnalyticsQuery(
  query: AnalyticsQuery,
  project: { id: string; timezone: string },
  now: Date = new Date(),
  opts: { defaultRangeMs?: number } = {},
): ResolvedAnalyticsQuery {
  const { from, to, timezone, compare, ...filters } = query;
  const r = resolveRange(
    { from, to, timezone, compare },
    { projectTimezone: project.timezone, now, defaultRangeMs: opts.defaultRangeMs },
  );
  const scope: AnalyticsScope = {
    projectId: project.id,
    range: { from: r.from, to: r.to },
    timezone: r.timezone,
    filters,
  };
  return r.previous ? { scope, previousScope: { ...scope, range: r.previous } } : { scope };
}

/** Whitelisted column — never interpolate user input via Prisma.raw. */
const TIME_COLUMNS = { published_at: "e.published_at", first_seen_at: "e.first_seen_at" } as const;

export function timeColumn(field: ScopeFilters["timeField"]): Prisma.Sql {
  return Prisma.raw(TIME_COLUMNS[field]);
}

const BUCKET_UNITS = { hour: "hour", day: "day" } as const;

/** Local-time bucket start (as timestamptz) for `col` in `timezone` (bound param). */
export function bucketExpr(col: Prisma.Sql, interval: keyof typeof BUCKET_UNITS, timezone: string): Prisma.Sql {
  const unit = Prisma.raw(`'${BUCKET_UNITS[interval]}'`);
  return Prisma.sql`(date_trunc(${unit}, ${col} AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})`;
}

function anyOf(col: string, values: readonly string[], cast?: string): Prisma.Sql {
  if (values.length === 0) return Prisma.empty;
  const c = cast ? Prisma.raw(`::${cast}[]`) : Prisma.empty;
  return Prisma.sql`AND ${Prisma.raw(col)} = ANY(${values}${c})`;
}

/**
 * FR-143 / drill-down equivalence (#201): `other` = stored 'other' or any non-NULL code outside the taxonomy,
 * the same fold as `languageCounts`. NULL (not analysed yet) is never `other`.
 */
export function languageFilter(values: readonly string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.empty;
  if (!values.includes("other")) return Prisma.sql`AND e.language_code = ANY(${values})`;
  return Prisma.sql`AND (e.language_code = ANY(${values}::text[]) OR (e.language_code IS NOT NULL AND NOT (e.language_code = ANY(${[...LANGUAGE_CODES]}::text[]))))`;
}

/**
 * CTE `base` — one row per post_id (FR-147): effective analysis (BR-025 via view), range [from,to),
 * ≥1 match with excluded_by_terms=false (all project queries incl. soft-deleted when queryIds empty, BR-010).
 * Default relevance=relevant comes from the schema (BR-016); pending/failed posts have NULL labels and drop out
 * whenever a label filter applies. Use `ignore` for coverage-style counts.
 */
export function buildBaseSetCte(scope: AnalyticsScope, opts: { ignore?: readonly IgnorableFilter[] } = {}): Prisma.Sql {
  const f = scope.filters;
  const skip = new Set(opts.ignore ?? []);
  const pick = <T>(k: IgnorableFilter, v: readonly T[]): readonly T[] => (skip.has(k) ? [] : v);
  const col = timeColumn(f.timeField);
  const queryFilter = f.queryIds.length > 0 ? Prisma.sql`AND m.query_id = ANY(${f.queryIds}::uuid[])` : Prisma.empty;
  const intent = pick("intent", f.intent);
  const topic = pick("topic", f.topic);
  const phrase = pick("phrase", f.phrase);
  // BR-042 term filter (#273): keep posts whose text or current-analysis phrases mention the term.
  const term = f.term && !skip.has("term") ? f.term : undefined;
  const termFilter = term
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM social_posts tp WHERE tp.id = e.post_id AND ${mentionsTermSql({
        normText: normalizedPostText(Prisma.sql`tp.text`),
        analysisIdCol: Prisma.sql`e.analysis_id`,
        term: Prisma.sql`${term}::text`,
      })})`
    : Prisma.empty;
  return Prisma.sql`base AS (
    SELECT e.post_id, e.published_at, e.first_seen_at, e.relevance_label, e.sentiment_label,
           e.safety_level, e.language_code, e.latest_run_status, e.analysis_id,
           e.relevance_confidence, e.sentiment_confidence, e.overall_model_confidence, e.summary, e.has_override
      FROM effective_post_analysis e
     WHERE e.project_id = ${scope.projectId}::uuid
       AND ${col} >= ${scope.range.from} AND ${col} < ${scope.range.to}
       AND EXISTS (SELECT 1 FROM post_query_matches m
                    WHERE m.post_id = e.post_id AND m.excluded_by_terms = false ${queryFilter})
       ${anyOf("e.relevance_label", pick("relevance", f.relevance), "relevance_label")}
       ${anyOf("e.sentiment_label", pick("sentiment", f.sentiment), "sentiment_label")}
       ${anyOf("e.safety_level", pick("safety", f.safety), "safety_level")}
       ${languageFilter(pick("language", f.language))}
       ${anyOf("e.latest_run_status", pick("analysisStatus", f.analysisStatus), "analysis_status")}
       ${intent.length > 0 ? Prisma.sql`AND EXISTS (SELECT 1 FROM effective_post_intents i WHERE i.post_id = e.post_id AND i.label = ANY(${intent}))` : Prisma.empty}
       ${topic.length > 0 ? Prisma.sql`AND EXISTS (SELECT 1 FROM effective_post_topics t WHERE t.post_id = e.post_id AND t.label = ANY(${topic}))` : Prisma.empty}
       ${phrase.length > 0 ? Prisma.sql`AND EXISTS (SELECT 1 FROM analysis_phrases ap WHERE ap.analysis_id = e.analysis_id AND ap.phrase = ANY(${phrase}::text[]))` : Prisma.empty}
       ${termFilter}
  )`;
}

export function withBase(
  scope: AnalyticsScope,
  body: Prisma.Sql,
  opts?: { ignore?: readonly IgnorableFilter[] },
): Prisma.Sql {
  return Prisma.sql`WITH ${buildBaseSetCte(scope, opts)} ${body}`;
}

/**
 * CTE `buckets` — every local-time bucket start (timestamptz) covering [from, to) (FR-135 zero-fill).
 * Series is stepped on local `timestamp` then converted back, so DST days stay one bucket; the last bucket
 * contains `to − 1µs`; the first may start before `from` (partial). Same expression as `bucketExpr` → exact join.
 * DISTINCT: on a spring-forward day the skipped local hour maps to the same instant as the next one.
 */
export function bucketSeriesCte(range: Range, interval: keyof typeof BUCKET_UNITS, timezone: string): Prisma.Sql {
  const unit = Prisma.raw(`'${BUCKET_UNITS[interval]}'`);
  const step = Prisma.raw(`interval '1 ${BUCKET_UNITS[interval]}'`);
  return Prisma.sql`buckets AS (
    SELECT DISTINCT (gs AT TIME ZONE ${timezone}) AS bucket
      FROM generate_series(
        date_trunc(${unit}, ${range.from}::timestamptz AT TIME ZONE ${timezone}),
        date_trunc(${unit}, (${range.to}::timestamptz - interval '1 microsecond') AT TIME ZONE ${timezone}),
        ${step}) gs
  )`;
}
