/**
 * Mentions list SQL builders (T-095) — docs/02-architecture/05-api-contract.md §7.
 * Starts from the analytics base set `B` so drill-down counts match (metric-definitions §6).
 */
import type { MentionSort, MentionsListQuery } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { resolveRange } from "../../common/time/range";
import { type AnalyticsScope, buildBaseSetCte } from "../analytics/analytics-filters";

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

/** Sort key columns as text (`k0`, `k1`…) — text keeps timestamptz µs and numeric precision for the cursor. */
export function sortKeySelect(spec: SortKey[]): Prisma.Sql {
  return Prisma.raw(spec.map((k, i) => `(${k.expr})::text AS k${i}`).join(", "));
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

/** Shared FROM/WHERE for page and count: base set B + optional text search. */
export function mentionsFromWhere(q: string | undefined): Prisma.Sql {
  return Prisma.sql`FROM base b JOIN social_posts p ON p.id = b.post_id WHERE true ${textSearchPredicate(q)}`;
}

export function withMentionsBase(scope: AnalyticsScope, body: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`WITH ${buildBaseSetCte(scope)} ${body}`;
}

export type MentionsScope = {
  scope: AnalyticsScope;
  q: string | undefined;
  sort: MentionSort;
  cursor: string | undefined;
  limit: number;
  count: boolean;
};

/**
 * Default range = last 7×24h like analytics (api-contract §6, BR-028: absolute UTC instants).
 * `reviewStatus` (P1) is accepted and ignored until review state exists (E11).
 */
export function resolveMentionsScope(
  query: MentionsListQuery,
  projectId: string,
  now: Date = new Date(),
): MentionsScope {
  const { from, to, timezone, q, sort, cursor, limit, count, reviewStatus: _reviewStatus, ...filters } = query;
  const r = resolveRange({ from, to, timezone }, { projectTimezone: timezone ?? "Asia/Ho_Chi_Minh", now });
  return {
    scope: { projectId, range: { from: r.from, to: r.to }, timezone: r.timezone, filters },
    q,
    sort,
    cursor,
    limit,
    count,
  };
}
