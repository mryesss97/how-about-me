import type { ReviewStatus } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";

/**
 * BR-040: a post is reviewed when `reviewed_at` ≥ `created_at` of its latest analysis run (or it has no run).
 * A run created after the review re-opens it. `p` must alias `social_posts` (code whitelist, never user input).
 */
export const REVIEWED_SQL = Prisma.raw(
  `(p.reviewed_at IS NOT NULL AND p.reviewed_at >= COALESCE(
     (SELECT max(rr.created_at) FROM analysis_runs rr WHERE rr.post_id = p.id), '-infinity'::timestamptz))`,
);

/** Q6 (#115): `reviewStatus[]` filter — empty or both values = no filter. */
export function reviewStatusPredicate(statuses: readonly ReviewStatus[]): Prisma.Sql {
  const set = new Set(statuses);
  if (set.size !== 1) return Prisma.empty;
  return set.has("reviewed") ? Prisma.sql`AND ${REVIEWED_SQL}` : Prisma.sql`AND NOT ${REVIEWED_SQL}`;
}
