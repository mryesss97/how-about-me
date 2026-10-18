/**
 * Mentions list SQL builders (T-095) — docs/02-architecture/05-api-contract.md §7.
 * Starts from the analytics base set `B` so drill-down counts match (metric-definitions §6).
 */
import type { MentionSort, MentionsListQuery, ReviewStatus } from "@how-about-me/contracts";
import { CONFIDENCE_BANDS } from "@how-about-me/taxonomy";
import { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors/app.error";
import { type SortCursor, decodeSortCursor } from "../../common/pagination/cursor";
import { isUtcMicrosKey, utcMicrosKeySql } from "../../common/pagination/created-at-keyset";
import { resolveRange } from "../../common/time/range";
import { type AnalyticsScope, buildBaseSetCte } from "../analytics/analytics-filters";
import { reviewStatusPredicate } from "../reviews/review-state.sql";

export type SortKey = { expr: string; dir: "asc" | "desc"; cast: "timestamptz" | "numeric" | "int" };

const SEVERITY = `(CASE b.safety_level WHEN 'severe' THEN 3 WHEN 'sensitive' THEN 2 WHEN 'safe' THEN 1 ELSE 0 END)`;
const RELEVANCE_RANK = `(CASE b.relevance_label WHEN 'relevant' THEN 3 WHEN 'uncertain' THEN 2 WHEN 'irrelevant' THEN 1 ELSE 0 END)`;
const PUB_DESC: SortKey = { expr: "b.published_at", dir: "desc", cast: "timestamptz" };

/**
 * Whitelisted sort keys (never user input). Every expression is NOT NULL (sentinels push NULLs last) so the
 * keyset predicate needs no NULL handling. `post_id` is always the final tie-breaker (same direction as last key).
 * Confidence ∈ [0,1] so sentinels 2 / −1 never collide with real values.
 */
export const MENTION_SORT_SPECS: Record<MentionSort, SortKey[]> = {
  newest: [PUB_DESC],
  oldest: [{ expr: "b.published_at", dir: "asc", cast: "timestamptz" }],
  safety_desc: [{ expr: SEVERITY, dir: "desc", cast: "int" }, PUB_DESC],
  // doc 08 §8: overall_model_confidence = min(relevance, sentiment); lowest first for review.
  confidence_asc: [{ expr: "COALESCE(b.overall_model_confidence, 2)", dir: "asc", cast: "numeric" }, PUB_DESC],
  relevance_desc: [
    { expr: RELEVANCE_RANK, dir: "desc", cast: "int" },
    { expr: "COALESCE(b.relevance_confidence, -1)", dir: "desc", cast: "numeric" },
    PUB_DESC,
  ],
};

const op = (dir: "asc" | "desc") => Prisma.raw(dir === "desc" ? "<" : ">");

/** Expanded OR form so mixed directions work: (k1 op v1) OR (k1 = v1 AND k2 op v2) OR … OR (… AND id op vid). */
export function keysetPredicate(spec: SortKey[], cursor: { keys: (string | number)[]; id: string } | null): Prisma.Sql {
  if (!cursor) return Prisma.empty;
  const last = spec[spec.length - 1];
  const terms: Prisma.Sql[] = [];
  const eqs: Prisma.Sql[] = [];
  spec.forEach((k, i) => {
    const val = Prisma.sql`${String(cursor.keys[i])}::${Prisma.raw(k.cast)}`;
    const e = Prisma.raw(k.expr);
    terms.push(Prisma.join([...eqs, Prisma.sql`${e} ${op(k.dir)} ${val}`], " AND ", "(", ")"));
    eqs.push(Prisma.sql`${e} = ${val}`);
  });
  terms.push(
    Prisma.join([...eqs, Prisma.sql`b.post_id ${op(last?.dir ?? "desc")} ${cursor.id}::uuid`], " AND ", "(", ")"),
  );
  return Prisma.sql`AND (${Prisma.join(terms, " OR ")})`;
}

export function orderBy(spec: SortKey[]): Prisma.Sql {
  const last = spec[spec.length - 1];
  const parts = [
    ...spec.map((k) => `${k.expr} ${k.dir.toUpperCase()}`),
    `b.post_id ${(last?.dir ?? "desc").toUpperCase()}`,
  ];
  return Prisma.raw(`ORDER BY ${parts.join(", ")}`);
}

/**
 * Sort key columns as text (`k0`, `k1`…). Timestamps use the deterministic UTC µs format (#188/#195,
 * independent of session DateStyle/TimeZone); int/numeric keep full precision via `::text`.
 */
export function sortKeySelect(spec: SortKey[]): Prisma.Sql {
  const cols = spec.map((k, i) =>
    k.cast === "timestamptz"
      ? Prisma.sql`${utcMicrosKeySql(k.expr)} AS ${Prisma.raw(`k${i}`)}`
      : Prisma.raw(`(${k.expr})::text AS k${i}`),
  );
  return Prisma.join(cols, ", ");
}

const INT_RE = /^-?\d{1,10}$/;
const NUMERIC_RE = /^-?\d{1,6}(\.\d{1,20})?$/;
const INT4_MIN = -(2 ** 31);
const INT4_MAX = 2 ** 31 - 1;

function normalizeKey(cast: SortKey["cast"], key: string | number): string | null {
  if (cast === "timestamptz") return isUtcMicrosKey(key) ? key : null;
  const s = String(key);
  if (cast === "int") {
    if (!INT_RE.test(s)) return null;
    const n = Number(s);
    return Number.isSafeInteger(n) && n >= INT4_MIN && n <= INT4_MAX ? s : null;
  }
  return NUMERIC_RE.test(s) ? s : null;
}

/** #195: decodes a mentions cursor and checks every key against its SQL cast so PG never throws (500 → 400). */
export function decodeMentionCursor(raw: string | undefined | null, sort: MentionSort): SortCursor | null {
  const spec = MENTION_SORT_SPECS[sort];
  const c = decodeSortCursor(raw, { sort, arity: spec.length });
  if (!c) return null;
  const keys = spec.map((k, i) => {
    const key = c.keys[i];
    const v = key === undefined ? null : normalizeKey(k.cast, key);
    if (v === null) throw new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
    return v;
  });
  return { sort, keys, id: c.id };
}

export function normalizeQ(q: string | undefined): string {
  return (q ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}

/** FR-161: short (< 3 code points) or letter/digit-free terms fall back to ILIKE; otherwise FTS. */
export function searchMode(q: string): "fts" | "ilike" {
  return [...q].length < 3 || !/[\p{L}\p{N}]/u.test(q) ? "ilike" : "fts";
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Text predicate on `p` (social_posts). `'simple'` config matches the generated `search_vector` column. */
export function textSearchPredicate(raw: string | undefined): Prisma.Sql {
  const q = normalizeQ(raw);
  if (!q) return Prisma.empty;
  if (searchMode(q) === "fts") return Prisma.sql`AND p.search_vector @@ websearch_to_tsquery('simple', ${q})`;
  return Prisma.sql`AND p.text ILIKE ${`%${escapeLike(q)}%`} ESCAPE '\\'`;
}

/** Shared FROM/WHERE for page and count: base set B + optional text search + optional review state (BR-040). */
export function mentionsFromWhere(
  q: string | undefined,
  reviewStatus: readonly ReviewStatus[] = [],
  opts: { withBands?: boolean } = {},
): Prisma.Sql {
  const bands = opts.withBands ? runPolicyBandsJoin(Prisma.raw("b.analysis_id")) : Prisma.empty;
  return Prisma.sql`FROM base b JOIN social_posts p ON p.id = b.post_id ${bands} WHERE true ${textSearchPredicate(q)} ${reviewStatusPredicate(reviewStatus)}`;
}

/**
 * #220 / BR-021, doc 08 §8: confidence bands of the policy the run that produced the current analysis used
 * (`analysis_settings` on project + `analysis_runs.safety_policy_version`). No row / missing key → v1 defaults
 * (bound values). Exposes `bands.high_band`, `bands.medium_band`; exactly one row per post (settings unique on
 * (project, policy_version)) so the base set is never multiplied (BR-002).
 */
export function runPolicyBandsJoin(analysisIdExpr: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`LEFT JOIN LATERAL (
    SELECT COALESCE((s.confidence_bands->>'high')::numeric, ${CONFIDENCE_BANDS.high}::numeric) AS high_band,
           COALESCE((s.confidence_bands->>'medium')::numeric, ${CONFIDENCE_BANDS.medium}::numeric) AS medium_band
      FROM (SELECT 1) one
      LEFT JOIN post_analyses bpa ON bpa.id = ${analysisIdExpr}
      LEFT JOIN analysis_runs br ON br.id = bpa.analysis_run_id
      LEFT JOIN analysis_settings s ON s.project_id = p.project_id AND s.policy_version = br.safety_policy_version
  ) bands ON true`;
}

export function withMentionsBase(scope: AnalyticsScope, body: Prisma.Sql): Prisma.Sql {
  // BR-016 exception (#328): status-only filters keep posts with no relevance yet (list, count, export, bulk).
  return Prisma.sql`WITH ${buildBaseSetCte(scope, { unlabelledMatchRelevance: true })} ${body}`;
}

export type MentionsScope = {
  scope: AnalyticsScope;
  q: string | undefined;
  sort: MentionSort;
  cursor: string | undefined;
  limit: number;
  count: boolean;
  /** BR-040 (#115): list + totalCount only; bulk re-analyze and export ignore it. */
  reviewStatus: ReviewStatus[];
};

export type FilterScope = { scope: AnalyticsScope; q: string | undefined; sort: MentionSort };

/**
 * Default range = last 7×24h like analytics (api-contract §6, BR-028: absolute UTC instants).
 * `reviewStatus` is dropped here (bulk re-analyze and export ignore it); the list applies it on top (#115, BR-040).
 * Shared by list and bulk re-analyze (T-145) so `matched` equals the list `totalCount` for the same filters.
 */
export function resolveFilterScope(
  query: Omit<MentionsListQuery, "cursor" | "limit" | "count">,
  projectId: string,
  now: Date = new Date(),
): FilterScope {
  const { from, to, timezone, q, sort, reviewStatus: _reviewStatus, ...filters } = query;
  const r = resolveRange({ from, to, timezone }, { projectTimezone: timezone ?? "Asia/Ho_Chi_Minh", now });
  return { scope: { projectId, range: { from: r.from, to: r.to }, timezone: r.timezone, filters }, q, sort };
}

export function resolveMentionsScope(
  query: MentionsListQuery,
  projectId: string,
  now: Date = new Date(),
): MentionsScope {
  const { cursor, limit, count, reviewStatus, ...rest } = query;
  return { ...resolveFilterScope({ ...rest, reviewStatus }, projectId, now), cursor, limit, count, reviewStatus };
}
