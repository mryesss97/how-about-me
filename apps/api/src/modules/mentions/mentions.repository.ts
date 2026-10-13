import {
  type AnalysisStatus,
  AnalysisStatusSchema,
  type AnalysisTrigger,
  type MentionListItem,
  type MentionSort,
  PlatformSchema,
  QueryTypeSchema,
  RelevanceLabelSchema,
  SafetyLevelSchema,
  SentimentLabelSchema,
} from "@how-about-me/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../database/prisma.service";
import type { AnalyticsScope } from "../analytics/analytics-filters";
import {
  keysetPredicate,
  MENTION_SORT_SPECS,
  mentionsFromWhere,
  orderBy,
  sortKeySelect,
  withMentionsBase,
} from "./mentions-query";

export type MentionForReanalyze = { id: string; projectId: string; contentHash: string; revision: number };

/** Upper bound for `count=true` (TC-MEN-023 < 1.5 s); on timeout `totalCount` is omitted. */
export const MENTIONS_COUNT_TIMEOUT_MS = 1500;

const num = z.union([z.number(), z.string(), z.instanceof(Prisma.Decimal)]).transform((v) => Number(v.toString()));
const nullableNum = num.nullable();

const MentionPageRowSchema = z.object({
  post_id: z.string(),
  platform: PlatformSchema,
  platform_post_id: z.string(),
  username: z.string().nullable(),
  permalink: z.string().nullable(),
  published_at: z.date(),
  text: z.string().nullable(),
  media_type: z.string().nullable(),
  thumbnail_url: z.string().nullable(),
  has_replies: z.boolean().nullable(),
  is_quote_post: z.boolean().nullable(),
  latest_run_status: AnalysisStatusSchema.nullable(),
  analysis_id: z.string().nullable(),
  relevance_label: RelevanceLabelSchema.nullable(),
  relevance_confidence: nullableNum,
  sentiment_label: SentimentLabelSchema.nullable(),
  sentiment_confidence: nullableNum,
  safety_level: SafetyLevelSchema.nullable(),
  language_code: z.string().nullable(),
  summary: z.string().nullable(),
  overall_model_confidence: nullableNum,
  has_override: z.boolean(),
  /** Sort keys as text (k0, k1, …) — collected into `keys` for the cursor. */
  keys: z.array(z.string()),
});
export type MentionPageRow = z.infer<typeof MentionPageRowSchema>;

/** Detail row (T-096): list columns + source extras + current analysis/run fields (no base-set filter). */
const MentionDetailRowSchema = MentionPageRowSchema.extend({
  owner_id: z.string().nullable(),
  shortcode: z.string().nullable(),
  media_url: z.string().nullable(),
  alt_text: z.string().nullable(),
  link_attachment_url: z.string().nullable(),
  quoted_post_id: z.string().nullable(),
  reposted_post_id: z.string().nullable(),
  first_seen_at: z.date(),
  last_seen_at: z.date(),
  revision: z.number().int(),
  content_hash: z.string(),
  relevance_explanation: z.string().nullable(),
  safety_category_scores: z.unknown().nullable(),
  safety_flagged: z.boolean().nullable(),
  classifier_provider: z.string().nullable(),
  classifier_model: z.string().nullable(),
  prompt_version: z.string().nullable(),
  taxonomy_version: z.string().nullable(),
  safety_provider: z.string().nullable(),
  safety_model: z.string().nullable(),
  safety_policy_version: z.string().nullable(),
  input_tokens: z.number().int().nullable(),
  output_tokens: z.number().int().nullable(),
  estimated_cost_usd: nullableNum,
  analyzed_at: z.date().nullable(),
});
export type MentionDetailRow = z.infer<typeof MentionDetailRowSchema>;

/** Max runs returned in mention detail (newest first, BR-003). */
export const MENTION_DETAIL_RUNS_LIMIT = 50;

export type MentionRunRow = {
  id: string;
  status: AnalysisStatus;
  trigger: AnalysisTrigger;
  effectiveVersion: string;
  createdAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  estimatedCostUsd: number | null;
};

type LabelConf = { label: string; confidence: number | null };
export type HydratedMentions = {
  matches: Map<string, MentionListItem["matchedQueries"]>;
  intents: Map<string, LabelConf[]>;
  topics: Map<string, LabelConf[]>;
  errorCodes: Map<string, string | null>;
};

const MatchRowSchema = z.object({
  post_id: z.string(),
  id: z.string(),
  display_name: z.string(),
  query_type: QueryTypeSchema,
  excluded_by_terms: z.boolean(),
});
const LabelRowSchema = z.object({ analysis_id: z.string(), label: z.string(), confidence: nullableNum });
const ErrorRowSchema = z.object({ post_id: z.string(), error_code: z.string().nullable() });
const AnalyzedAtRowSchema = z.object({ id: z.string(), analyzed_at: z.date() });
const CountRowSchema = z.object({ n: num });

function group<T, V>(rows: T[], key: (r: T) => string, val: (r: T) => V): Map<string, V[]> {
  const m = new Map<string, V[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k) ?? [];
    list.push(val(r));
    m.set(k, list);
  }
  return m;
}

/** Postgres 57014 (query_canceled by statement_timeout), as surfaced by Prisma raw queries. */
function isStatementTimeout(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = e.meta as Record<string, unknown> | undefined;
    if (meta?.code === "57014") return true;
  }
  return e instanceof Error && /statement timeout/i.test(e.message);
}

/** Data access for mentions (social_posts) — FR-115, FR-150/152/153/161. */
@Injectable()
export class MentionsRepository {
  /** Overridable in tests. */
  countTimeoutMs = MENTIONS_COUNT_TIMEOUT_MS;

  constructor(private readonly prisma: PrismaService) {}

  /** Scoped to the project so a post of another project is indistinguishable from a missing one. */
  findInProject(tx: Prisma.TransactionClient, projectId: string, id: string): Promise<MentionForReanalyze | null> {
    return tx.socialPost.findFirst({
      where: { id, projectId },
      select: { id: true, projectId: true, contentHash: true, revision: true },
    });
  }

  /** BR-024 / FR-115: any open run of the post (any hash or version) counts as "already pending". */
  async hasOpenRun(tx: Prisma.TransactionClient, postId: string): Promise<boolean> {
    const n = await tx.analysisRun.count({ where: { postId, status: { in: ["pending", "processing"] } } });
    return n > 0;
  }

  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    opts?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    return this.prisma.$transaction(fn, opts);
  }

  /** Exact count for bulk re-analyze (T-145): same SQL as `count()` but without the 1.5 s bound. */
  async countMatched(
    scope: AnalyticsScope,
    q: string | undefined,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const rows = await db.$queryRaw<unknown[]>(
      withMentionsBase(scope, Prisma.sql`SELECT count(*)::int AS n ${mentionsFromWhere(q)}`),
    );
    return CountRowSchema.parse(rows[0]).n;
  }

  /**
   * Up to `limit` posts of the filtered set that can actually be enqueued (T-145, FR-196), in `sort` order:
   * no open run (FR-115) and no completed run for the same (hash, effective_version) (BR-024, FR-116).
   */
  async selectBulkCandidates(
    tx: Prisma.TransactionClient,
    scope: AnalyticsScope,
    q: string | undefined,
    sort: MentionSort,
    effectiveVersion: string,
    limit: number,
  ): Promise<MentionForReanalyze[]> {
    if (limit <= 0) return [];
    const rows = await tx.$queryRaw<{ id: string; content_hash: string; revision: number }[]>(
      withMentionsBase(
        scope,
        Prisma.sql`SELECT p.id, p.content_hash, p.revision ${mentionsFromWhere(q)}
          AND NOT EXISTS (SELECT 1 FROM analysis_runs o WHERE o.post_id = p.id AND o.status IN ('pending', 'processing'))
          AND NOT EXISTS (SELECT 1 FROM analysis_runs d WHERE d.post_id = p.id
            AND d.source_content_hash = p.content_hash AND d.effective_version = ${effectiveVersion}
            AND d.status = 'completed')
          ${orderBy(MENTION_SORT_SPECS[sort])}
          LIMIT ${limit}`,
      ),
    );
    return rows.map((r) => ({
      id: r.id,
      projectId: scope.projectId,
      contentHash: r.content_hash,
      revision: r.revision,
    }));
  }

  /**
   * One page (limit + 1 rows) from base set B (BR-002: one row per post — never JOIN matches here).
   * Keyset on whitelisted sort keys; all values bound.
   */
  async listPage(
    scope: AnalyticsScope,
    q: string | undefined,
    sort: MentionSort,
    cursor: { keys: (string | number)[]; id: string } | null,
    limit: number,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<MentionPageRow[]> {
    const spec = MENTION_SORT_SPECS[sort];
    const rows = await db.$queryRaw<Record<string, unknown>[]>(
      withMentionsBase(
        scope,
        Prisma.sql`SELECT b.post_id::text AS post_id, p.platform::text AS platform, p.platform_post_id, p.username, p.permalink,
                          p.published_at, p.text, p.media_type, p.thumbnail_url, p.has_replies, p.is_quote_post,
                          b.latest_run_status::text AS latest_run_status, b.analysis_id::text AS analysis_id,
                          b.relevance_label::text AS relevance_label, b.relevance_confidence,
                          b.sentiment_label::text AS sentiment_label, b.sentiment_confidence,
                          b.safety_level::text AS safety_level, b.language_code, b.summary,
                          b.overall_model_confidence, COALESCE(b.has_override, false) AS has_override,
                          ${sortKeySelect(spec)}
                     ${mentionsFromWhere(q)} ${keysetPredicate(spec, cursor)}
                     ${orderBy(spec)} LIMIT ${limit + 1}`,
      ),
    );
    return rows.map((r) => MentionPageRowSchema.parse({ ...r, keys: spec.map((_k, i) => r[`k${i}`]) }));
  }

  /**
   * T-096 / FR-154: one post of the project with its effective analysis (BR-025) and the run that produced the
   * current AI analysis. No base-set filter: irrelevant / unanalysed posts are still readable. Scoped by project →
   * another project's post is indistinguishable from a missing one (404).
   */
  async findDetail(projectId: string, postId: string): Promise<MentionDetailRow | null> {
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT p.id::text AS post_id, p.platform::text AS platform, p.platform_post_id, p.username, p.permalink,
             p.published_at, p.text, p.media_type, p.thumbnail_url, p.has_replies, p.is_quote_post,
             p.owner_id, p.shortcode, p.media_url, p.alt_text, p.link_attachment_url, p.quoted_post_id,
             p.reposted_post_id, p.first_seen_at, p.last_seen_at, p.revision, p.content_hash,
             e.latest_run_status::text AS latest_run_status, e.analysis_id::text AS analysis_id,
             e.relevance_label::text AS relevance_label, e.relevance_confidence,
             e.sentiment_label::text AS sentiment_label, e.sentiment_confidence,
             e.safety_level::text AS safety_level, e.language_code, e.summary,
             e.overall_model_confidence, COALESCE(e.has_override, false) AS has_override,
             pa.relevance_explanation, pa.safety_category_scores, pa.safety_flagged,
             r.classifier_provider, r.classifier_model, r.prompt_version, r.taxonomy_version,
             r.safety_provider, r.safety_model, r.safety_policy_version,
             r.input_tokens, r.output_tokens, r.estimated_cost_usd,
             COALESCE(r.completed_at, pa.created_at) AS analyzed_at
        FROM social_posts p
        LEFT JOIN effective_post_analysis e ON e.post_id = p.id
        LEFT JOIN post_analyses pa ON pa.id = e.analysis_id
        LEFT JOIN analysis_runs r ON r.id = pa.analysis_run_id
       WHERE p.id = ${postId}::uuid AND p.project_id = ${projectId}::uuid`);
    const row = rows[0];
    return row ? MentionDetailRowSchema.parse({ ...row, keys: [] }) : null;
  }

  /** BR-003: run history (append-only), newest first, capped at MENTION_DETAIL_RUNS_LIMIT. */
  async listRuns(postId: string): Promise<MentionRunRow[]> {
    const runs = await this.prisma.analysisRun.findMany({
      where: { postId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MENTION_DETAIL_RUNS_LIMIT,
      select: {
        id: true,
        status: true,
        trigger: true,
        effectiveVersion: true,
        createdAt: true,
        completedAt: true,
        errorCode: true,
        estimatedCostUsd: true,
      },
    });
    return runs.map((r) => ({
      ...r,
      estimatedCostUsd: r.estimatedCostUsd == null ? null : Number(r.estimatedCostUsd.toString()),
    }));
  }

  /** T-147: `analyzed_at` of the given analyses = COALESCE(run.completed_at, analysis.created_at) (same as detail). */
  async analyzedAtByAnalysis(analysisIds: string[]): Promise<Map<string, Date>> {
    if (analysisIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<unknown[]>(Prisma.sql`
      SELECT pa.id::text AS id, COALESCE(r.completed_at, pa.created_at) AS analyzed_at
        FROM post_analyses pa LEFT JOIN analysis_runs r ON r.id = pa.analysis_run_id
       WHERE pa.id = ANY(${analysisIds}::uuid[])`);
    return new Map(rows.map((r) => AnalyzedAtRowSchema.parse(r)).map((r) => [r.id, r.analyzed_at]));
  }

  /** Fixed number of batch queries per page (no N+1). */
  async hydrate(postIds: string[], analysisIds: string[]): Promise<HydratedMentions> {
    if (postIds.length === 0)
      return { matches: new Map(), intents: new Map(), topics: new Map(), errorCodes: new Map() };
    const labels = (table: "analysis_intents" | "analysis_topics"): Promise<unknown[]> =>
      analysisIds.length === 0
        ? Promise.resolve([])
        : this.prisma.$queryRaw<unknown[]>(Prisma.sql`
            SELECT analysis_id::text AS analysis_id, label::text AS label, confidence FROM ${Prisma.raw(table)}
             WHERE analysis_id = ANY(${analysisIds}::uuid[]) ORDER BY confidence DESC NULLS LAST, label`);
    const [matches, intents, topics, errors] = await Promise.all([
      // BR-010: soft-deleted queries still shown; excluded matches shown as chips (TC-MEN-021).
      this.prisma.$queryRaw<unknown[]>(Prisma.sql`
        SELECT m.post_id::text AS post_id, q.id::text AS id, q.display_name, q.query_type::text AS query_type,
               m.excluded_by_terms
          FROM post_query_matches m JOIN listening_queries q ON q.id = m.query_id
         WHERE m.post_id = ANY(${postIds}::uuid[])
         ORDER BY m.first_matched_at, m.query_id`),
      labels("analysis_intents"),
      labels("analysis_topics"),
      // FR-156: latest run's error code (used only when status=failed).
      this.prisma.$queryRaw<unknown[]>(Prisma.sql`
        SELECT DISTINCT ON (post_id) post_id::text AS post_id, error_code FROM analysis_runs
         WHERE post_id = ANY(${postIds}::uuid[]) ORDER BY post_id, created_at DESC`),
    ]);
    const label = (r: z.infer<typeof LabelRowSchema>) => ({ label: r.label, confidence: r.confidence });
    const m = matches.map((r) => MatchRowSchema.parse(r));
    const e = errors.map((r) => ErrorRowSchema.parse(r));
    return {
      matches: group(
        m,
        (r) => r.post_id,
        (r) => ({
          id: r.id,
          displayName: r.display_name,
          queryType: r.query_type,
          excludedByTerms: r.excluded_by_terms,
        }),
      ),
      intents: group(
        intents.map((r) => LabelRowSchema.parse(r)),
        (r) => r.analysis_id,
        label,
      ),
      topics: group(
        topics.map((r) => LabelRowSchema.parse(r)),
        (r) => r.analysis_id,
        label,
      ),
      errorCodes: new Map(e.map((r) => [r.post_id, r.error_code])),
    };
  }

  /**
   * `count=true`: exact COUNT over the same filtered set (ignores cursor) — drill-down equivalence (metric-defs §6).
   * Bounded by a transaction-local statement_timeout; returns null on timeout.
   */
  async count(scope: AnalyticsScope, q: string | undefined): Promise<number | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(this.countTimeoutMs)}, true)`;
        const rows = await tx.$queryRaw<unknown[]>(
          withMentionsBase(scope, Prisma.sql`SELECT count(*)::int AS n ${mentionsFromWhere(q)}`),
        );
        return CountRowSchema.parse(rows[0]).n;
      });
    } catch (e) {
      if (isStatementTimeout(e)) return null;
      throw e;
    }
  }
}
