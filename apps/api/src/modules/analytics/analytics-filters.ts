/**
 * Analytics foundation (T-090): resolves filters into a scope and builds the shared base set `B`
 * — docs/01-product/07-metric-definitions.md §0, §5. Every analytics widget must start from `base`.
 */
import type { AnalysisFilters, AnalyticsQuery } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { type Range, resolveRange } from "../../common/time/range";

export type ScopeFilters = Omit<AnalysisFilters, "from" | "to" | "timezone">;
export type AnalyticsScope = { projectId: string; range: Range; timezone: string; filters: ScopeFilters };
export type ResolvedAnalyticsQuery = { scope: AnalyticsScope; previousScope?: AnalyticsScope };

export type IgnorableFilter = "relevance" | "sentiment" | "safety" | "language" | "analysisStatus" | "intent" | "topic";

export function resolveAnalyticsQuery(
  query: AnalyticsQuery,
  project: { id: string; timezone: string },
  now: Date = new Date(),
): ResolvedAnalyticsQuery {
  const { from, to, timezone, compare, ...filters } = query;
  const r = resolveRange({ from, to, timezone, compare }, { projectTimezone: project.timezone, now });
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
  return Prisma.sql`base AS (
    SELECT e.post_id, e.published_at, e.first_seen_at, e.relevance_label, e.sentiment_label,
           e.safety_level, e.language_code, e.latest_run_status, e.analysis_id
      FROM effective_post_analysis e
     WHERE e.project_id = ${scope.projectId}::uuid
       AND ${col} >= ${scope.range.from} AND ${col} < ${scope.range.to}
       AND EXISTS (SELECT 1 FROM post_query_matches m
                    WHERE m.post_id = e.post_id AND m.excluded_by_terms = false ${queryFilter})
       ${anyOf("e.relevance_label", pick("relevance", f.relevance), "relevance_label")}
       ${anyOf("e.sentiment_label", pick("sentiment", f.sentiment), "sentiment_label")}
       ${anyOf("e.safety_level", pick("safety", f.safety), "safety_level")}
       ${anyOf("e.language_code", pick("language", f.language))}
       ${anyOf("e.latest_run_status", pick("analysisStatus", f.analysisStatus), "analysis_status")}
       ${intent.length > 0 ? Prisma.sql`AND EXISTS (SELECT 1 FROM analysis_intents i WHERE i.analysis_id = e.analysis_id AND i.label = ANY(${intent}))` : Prisma.empty}
       ${topic.length > 0 ? Prisma.sql`AND EXISTS (SELECT 1 FROM analysis_topics t WHERE t.analysis_id = e.analysis_id AND t.label = ANY(${topic}))` : Prisma.empty}
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
