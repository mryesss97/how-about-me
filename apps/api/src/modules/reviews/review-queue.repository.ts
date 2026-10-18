import {
  AnalysisStatusSchema,
  PlatformSchema,
  RelevanceLabelSchema,
  type ReviewReason,
  type ReviewQueueCounts,
  type ReviewStatus,
  SentimentLabelSchema,
} from "@how-about-me/contracts";
import { CONFIDENCE_BANDS } from "@how-about-me/taxonomy";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { utcMicrosKeySql } from "../../common/pagination/created-at-keyset";
import { PrismaService } from "../../database/prisma.service";

/** Upper bound for `count=true` (same budget as mentions, TC-MEN-023); on timeout `counts` is omitted. */
export const REVIEW_COUNT_TIMEOUT_MS = 1500;

/** Keyset sort id bound into the cursor: `published_at DESC, post_id DESC`. */
export const REVIEW_SORT = "review_newest";

const num = z.union([z.number(), z.string(), z.instanceof(Prisma.Decimal)]).transform((v) => Number(v.toString()));

const ReviewQueueRowSchema = z.object({
  post_id: z.string(),
  platform: PlatformSchema,
  platform_post_id: z.string(),
  username: z.string().nullable(),
  permalink: z.string().nullable(),
  published_at: z.date(),
  text: z.string().nullable(),
  latest_run_status: AnalysisStatusSchema.nullable(),
  relevance_label: RelevanceLabelSchema.nullable(),
  sentiment_label: SentimentLabelSchema.nullable(),
  overall_model_confidence: num.nullable(),
  has_override: z.boolean(),
  error_code: z.string().nullable(),
  medium_band: num,
  high_band: num,
  is_uncertain: z.boolean(),
  is_low: z.boolean(),
  is_failed: z.boolean(),
  reviewed_at: z.date().nullable(),
  reviewed_by: z.string().nullable(),
  /** Cursor key: published_at in UTC µs text (#188/#195). */
  k0: z.string(),
});
export type ReviewQueueRow = z.infer<typeof ReviewQueueRowSchema>;

const ReviewStateRowSchema = z.object({
  is_uncertain: z.boolean(),
  is_low: z.boolean(),
  is_failed: z.boolean(),
  is_reviewed: z.boolean(),
  reviewed_at: z.date().nullable(),
});
export type ReviewStateRow = z.infer<typeof ReviewStateRowSchema>;

const CountsRowSchema = z.object({ all: num, uncertain: num, low_confidence: num, failed: num });
const IdRowSchema = z.object({ id: z.string() });

export type ReviewCursor = { key: string; id: string };

/** Postgres 57014 (query_canceled by statement_timeout), as surfaced by Prisma raw queries. */
function isStatementTimeout(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = e.meta as Record<string, unknown> | undefined;
    if (meta?.code === "57014") return true;
  }
  return e instanceof Error && /statement timeout/i.test(e.message);
}

const REASON_COLUMN: Record<ReviewReason, Prisma.Sql> = {
  uncertain: Prisma.raw("f.is_uncertain"),
  low_confidence: Prisma.raw("f.is_low"),
  failed: Prisma.raw("f.is_failed"),
};

/**
 * CTE `f`: one row per post of the queue scope with reason flags (FR-195).
 * - Scope: project, ≥ 1 non-excluded match (BR-007), effective relevance ≠ irrelevant (BR-016, BR-025; unanalysed kept).
 * - uncertain = effective relevance `uncertain` (BR-025: an override to `relevant` drops it).
 * - low_confidence = AI overall confidence < medium band of the policy the run was analysed with (doc 08 §8, BR-021);
 *   no analysis_settings row → v1 defaults (bound values, not interpolated).
 * - failed = latest run failed.
 * - is_reviewed per BR-040: reviewed_at ≥ latest run created_at (or no run).
 * One row per post: matches via EXISTS, latest run via LATERAL … LIMIT 1, settings unique on (project, policy_version).
 */
function queueCte(projectId: string, postId?: string): Prisma.Sql {
  // #339: optional single-post filter for mention detail (bound value).
  const onePost = postId ? Prisma.sql`AND p.id = ${postId}::uuid` : Prisma.empty;
  return Prisma.sql`q AS (
    SELECT p.id AS post_id, p.platform::text AS platform, p.platform_post_id, p.username, p.permalink,
           p.published_at, p.text, p.latest_run_status::text AS latest_run_status,
           e.relevance_label::text AS relevance_label, e.sentiment_label::text AS sentiment_label,
           e.overall_model_confidence, COALESCE(e.has_override, false) AS has_override,
           lr.error_code, p.reviewed_at, p.reviewed_by::text AS reviewed_by,
           COALESCE((s.confidence_bands->>'medium')::numeric, ${CONFIDENCE_BANDS.medium}::numeric) AS medium_band,
           COALESCE((s.confidence_bands->>'high')::numeric, ${CONFIDENCE_BANDS.high}::numeric) AS high_band,
           (p.reviewed_at IS NOT NULL AND p.reviewed_at >= COALESCE(lr.created_at, '-infinity'::timestamptz)) AS is_reviewed
      FROM social_posts p
      LEFT JOIN effective_post_analysis e ON e.post_id = p.id
      LEFT JOIN post_analyses pa ON pa.id = e.analysis_id
      LEFT JOIN analysis_runs r ON r.id = pa.analysis_run_id
      LEFT JOIN analysis_settings s ON s.project_id = p.project_id AND s.policy_version = r.safety_policy_version
      LEFT JOIN LATERAL (
        SELECT x.created_at, x.error_code FROM analysis_runs x
         WHERE x.post_id = p.id ORDER BY x.created_at DESC, x.id DESC LIMIT 1
      ) lr ON true
     WHERE p.project_id = ${projectId}::uuid
       AND EXISTS (SELECT 1 FROM post_query_matches m WHERE m.post_id = p.id AND m.excluded_by_terms = false)
       AND e.relevance_label IS DISTINCT FROM 'irrelevant'
       ${onePost}
  ), f AS (
    SELECT q.*,
           COALESCE(q.relevance_label = 'uncertain', false) AS is_uncertain,
           COALESCE(q.overall_model_confidence < q.medium_band, false) AS is_low,
           COALESCE(q.latest_run_status = 'failed', false) AS is_failed
      FROM q
  )`;
}

function statusPredicate(status: ReviewStatus): Prisma.Sql {
  return status === "reviewed" ? Prisma.sql`AND f.is_reviewed` : Prisma.sql`AND NOT f.is_reviewed`;
}

const ANY_REASON = Prisma.sql`(f.is_uncertain OR f.is_low OR f.is_failed)`;

/** Data access for the review queue — T-144, FR-195, BR-040 (docs/02-architecture/05-api-contract.md "Reviews"). */
@Injectable()
export class ReviewQueueRepository {
  /** Overridable in tests. */
  countTimeoutMs = REVIEW_COUNT_TIMEOUT_MS;

  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /** limit + 1 rows, newest first; all values bound. */
  async listPage(
    projectId: string,
    filter: { reason: ReviewReason | undefined; status: ReviewStatus },
    cursor: ReviewCursor | null,
    limit: number,
  ): Promise<ReviewQueueRow[]> {
    const reason = filter.reason ? Prisma.sql`AND ${REASON_COLUMN[filter.reason]}` : Prisma.empty;
    const keyset = cursor
      ? Prisma.sql`AND (f.published_at < ${cursor.key}::timestamptz
                    OR (f.published_at = ${cursor.key}::timestamptz AND f.post_id < ${cursor.id}::uuid))`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
      WITH ${queueCte(projectId)}
      SELECT f.post_id::text AS post_id, f.platform, f.platform_post_id, f.username, f.permalink, f.published_at,
             f.text, f.latest_run_status, f.relevance_label, f.sentiment_label, f.overall_model_confidence,
             f.has_override, f.error_code, f.medium_band, f.high_band, f.is_uncertain, f.is_low, f.is_failed,
             f.reviewed_at, f.reviewed_by, ${utcMicrosKeySql("f.published_at")} AS k0
        FROM f
       WHERE ${ANY_REASON} ${reason} ${statusPredicate(filter.status)} ${keyset}
       ORDER BY f.published_at DESC, f.post_id DESC
       LIMIT ${limit + 1}`);
    return rows.map((r) => ReviewQueueRowSchema.parse(r));
  }

  /**
   * #339: queue flags of one post (same CTE as the list, FR-195/BR-040/BR-016/BR-007); null when the post is
   * outside the queue scope (no row). The mapper turns a row without any reason into null too.
   */
  async findState(projectId: string, postId: string): Promise<ReviewStateRow | null> {
    const rows = await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
      WITH ${queueCte(projectId, postId)}
      SELECT f.is_uncertain, f.is_low, f.is_failed, f.is_reviewed, f.reviewed_at FROM f LIMIT 1`);
    return rows[0] ? ReviewStateRowSchema.parse(rows[0]) : null;
  }

  /** Tab badge counts for `status` in one query, bounded by a transaction-local statement_timeout; null on timeout. */
  async counts(projectId: string, status: ReviewStatus): Promise<ReviewQueueCounts | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(this.countTimeoutMs)}, true)`;
        const rows = await tx.$queryRaw<unknown[]>(Prisma.sql`
          WITH ${queueCte(projectId)}
          SELECT count(*)::int AS "all",
                 count(*) FILTER (WHERE f.is_uncertain)::int AS uncertain,
                 count(*) FILTER (WHERE f.is_low)::int AS low_confidence,
                 count(*) FILTER (WHERE f.is_failed)::int AS failed
            FROM f WHERE ${ANY_REASON} ${statusPredicate(status)}`);
        const c = CountsRowSchema.parse(rows[0]);
        return { all: c.all, uncertain: c.uncertain, lowConfidence: c.low_confidence, failed: c.failed };
      });
    } catch (e) {
      if (isStatementTimeout(e)) return null;
      throw e;
    }
  }

  /**
   * Marks the given posts of the project reviewed (idempotent: re-marking refreshes reviewed_at/by).
   * Ids of other projects are silently skipped. Returns the updated ids.
   * BR-040 compares reviewed_at with runs' created_at (DB `now()`), so reviewed_at uses the DB clock too, and never
   * sits before an existing run: a Node timestamp could drift and leave a fresh review older than the latest run.
   */
  async markReviewed(
    tx: Prisma.TransactionClient,
    projectId: string,
    postIds: string[],
    userId: string,
  ): Promise<string[]> {
    const rows = await tx.$queryRaw<unknown[]>(Prisma.sql`
      UPDATE social_posts SET reviewed_at = GREATEST(now(),
               COALESCE((SELECT max(rr.created_at) FROM analysis_runs rr WHERE rr.post_id = social_posts.id), now())),
             reviewed_by = ${userId}::uuid
       WHERE project_id = ${projectId}::uuid AND id = ANY(${postIds}::uuid[])
       RETURNING id::text AS id`);
    return rows.map((r) => IdRowSchema.parse(r).id);
  }
}
