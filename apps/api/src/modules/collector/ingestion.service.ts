import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { PrismaService } from "../../database/prisma.service";
import { ANALYSIS_ENQUEUER, type AnalysisEnqueuer, type EnqueueTrigger } from "../analysis/analysis-enqueuer";
import { evaluateTerms } from "../listening-queries/term-matcher";
import type { NormalizedPost } from "./post-normalizer";

export type IngestionQuery = {
  id: string;
  projectId: string;
  platform: "threads";
  includeTerms: string[];
  excludeTerms: string[];
};

/** Per-page counters; SyncJob (later ticket) sums them into `records_*` (TC-COL-015). */
export type IngestPageResult = {
  inserted: number;
  updated: number;
  duplicated: number;
  excluded: number;
  enqueued: number;
};

type UpsertRow = { id: string; revision: number; inserted: boolean; prev_hash: string | null };

/**
 * Writes one provider page idempotently in a single transaction —
 * docs/02-architecture/06-ingestion-pipeline.md §6 · BR-002, BR-003, BR-007, BR-024 · FR-076…FR-078, FR-088.
 */
@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ANALYSIS_ENQUEUER) private readonly enqueuer: AnalysisEnqueuer,
  ) {}

  /**
   * `afterPage` runs inside the same transaction (T-052): the collector adds the page's counters and
   * `last_cursor` to `sync_jobs` there, so a crash never leaves posts committed without their counters.
   */
  async ingestPage(
    query: IngestionQuery,
    posts: readonly NormalizedPost[],
    afterPage?: (tx: Prisma.TransactionClient, result: IngestPageResult) => Promise<void>,
  ): Promise<IngestPageResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const result: IngestPageResult = { inserted: 0, updated: 0, duplicated: 0, excluded: 0, enqueued: 0 };
        for (const post of posts) await this.ingestOne(tx, query, post, result);
        if (afterPage) await afterPage(tx, result);
        return result;
      },
      { timeout: 30_000 },
    );
  }

  private async ingestOne(
    tx: Prisma.TransactionClient,
    query: IngestionQuery,
    post: NormalizedPost,
    result: IngestPageResult,
  ): Promise<void> {
    const row = await this.upsertPost(tx, query, post);
    // BR-003: an edit is a change of content hash on an existing row. A duplicate inside the same
    // page sees its own earlier insert, so it counts as duplicated. `prev_hash = null` on a conflict
    // means a concurrent job inserted the row after our `SELECT … FOR UPDATE`; the upsert bumped
    // `revision` only if that row's hash differed, so `revision > 1` is the change signal there.
    const changed = !row.inserted && (row.prev_hash === null ? row.revision > 1 : row.prev_hash !== post.contentHash);

    // BR-007: excluded posts are stored and matched, but flagged.
    const { excluded } = evaluateTerms(post.text, query.includeTerms, query.excludeTerms);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO post_query_matches (post_id, query_id, first_matched_at, last_matched_at, excluded_by_terms)
      VALUES (${row.id}::uuid, ${query.id}::uuid, now(), now(), ${excluded})
      ON CONFLICT (post_id, query_id) DO UPDATE
        SET last_matched_at = now(), excluded_by_terms = EXCLUDED.excluded_by_terms`);
    if (excluded) result.excluded++;

    let trigger: EnqueueTrigger | null = null;
    if (row.inserted) {
      result.inserted++;
      trigger = "ingest";
    } else if (changed) {
      result.updated++;
      await this.enqueuer.markCurrentStale(tx, row.id, post.contentHash);
      trigger = "content_change";
    } else {
      result.duplicated++;
      // Owner decision 2026-10-13: a post that only had excluded matches gets its first run once a
      // non-excluded match appears; posts that already have runs are left alone.
      if (!(await this.hasAnyRun(tx, row.id))) trigger = "ingest";
    }

    // BR-007 / TC-LQ-016: analysis only when ≥ 1 non-excluded match exists.
    if (trigger && (await this.hasActiveMatch(tx, row.id))) {
      const created = await this.enqueuer.enqueue(tx, {
        postId: row.id,
        projectId: query.projectId,
        contentHash: post.contentHash,
        revision: row.revision,
        trigger,
      });
      if (created) result.enqueued++;
    }
  }

  /**
   * BR-002 upsert on (platform, platform_post_id). `RETURNING` only sees the new row, so the old hash
   * is read first with `SELECT … FOR UPDATE` in the same transaction; `xmax = 0` tells an insert from an update.
   * `project_id` and `first_seen_at` are kept from the first ingest.
   */
  private async upsertPost(tx: Prisma.TransactionClient, query: IngestionQuery, p: NormalizedPost): Promise<UpsertRow> {
    const prev = await tx.$queryRaw<{ content_hash: string }[]>(Prisma.sql`
      SELECT content_hash FROM social_posts
      WHERE platform = ${query.platform}::platform AND platform_post_id = ${p.platformPostId}
      FOR UPDATE`);
    const rows = await tx.$queryRaw<Omit<UpsertRow, "prev_hash">[]>(Prisma.sql`
      INSERT INTO social_posts (
        id, project_id, platform, platform_post_id, username, owner_id, text, permalink, shortcode,
        media_type, media_url, thumbnail_url, alt_text, link_attachment_url, is_quote_post, has_replies,
        quoted_post_id, reposted_post_id, published_at, content_hash, revision, raw_data, raw_truncated,
        first_seen_at, last_seen_at, updated_at
      ) VALUES (
        ${uuidv7()}::uuid, ${query.projectId}::uuid, ${query.platform}::platform, ${p.platformPostId},
        ${p.username}, ${p.ownerId}, ${p.text}, ${p.permalink}, ${p.shortcode},
        ${p.mediaType}, ${p.mediaUrl}, ${p.thumbnailUrl}, ${p.altText}, ${p.linkAttachmentUrl},
        ${p.isQuotePost}, ${p.hasReplies}, ${p.quotedPostId}, ${p.repostedPostId}, ${p.publishedAt},
        ${p.contentHash}, 1, ${JSON.stringify(p.rawData)}::jsonb, ${p.rawTruncated}, now(), now(), now()
      )
      ON CONFLICT (platform, platform_post_id) DO UPDATE SET
        last_seen_at = now(),
        username = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.username ELSE social_posts.username END,
        owner_id = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.owner_id ELSE social_posts.owner_id END,
        text = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.text ELSE social_posts.text END,
        permalink = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.permalink ELSE social_posts.permalink END,
        shortcode = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.shortcode ELSE social_posts.shortcode END,
        media_type = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.media_type ELSE social_posts.media_type END,
        media_url = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.media_url ELSE social_posts.media_url END,
        thumbnail_url = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.thumbnail_url ELSE social_posts.thumbnail_url END,
        alt_text = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.alt_text ELSE social_posts.alt_text END,
        link_attachment_url = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.link_attachment_url ELSE social_posts.link_attachment_url END,
        is_quote_post = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.is_quote_post ELSE social_posts.is_quote_post END,
        has_replies = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.has_replies ELSE social_posts.has_replies END,
        quoted_post_id = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.quoted_post_id ELSE social_posts.quoted_post_id END,
        reposted_post_id = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.reposted_post_id ELSE social_posts.reposted_post_id END,
        published_at = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.published_at ELSE social_posts.published_at END,
        raw_data = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.raw_data ELSE social_posts.raw_data END,
        raw_truncated = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN EXCLUDED.raw_truncated ELSE social_posts.raw_truncated END,
        revision = social_posts.revision + (social_posts.content_hash <> EXCLUDED.content_hash)::int,
        updated_at = CASE WHEN social_posts.content_hash <> EXCLUDED.content_hash THEN now() ELSE social_posts.updated_at END,
        content_hash = EXCLUDED.content_hash
      RETURNING id, revision, (xmax = 0) AS inserted`);
    const row = rows[0];
    if (!row) throw new Error(`upsert returned no row for ${p.platformPostId}`);
    return { ...row, prev_hash: prev[0]?.content_hash ?? null };
  }

  private async hasActiveMatch(tx: Prisma.TransactionClient, postId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ ok: boolean }[]>(Prisma.sql`
      SELECT EXISTS (SELECT 1 FROM post_query_matches WHERE post_id = ${postId}::uuid AND excluded_by_terms = false) AS ok`);
    return rows[0]?.ok === true;
  }

  private async hasAnyRun(tx: Prisma.TransactionClient, postId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ ok: boolean }[]>(Prisma.sql`
      SELECT EXISTS (SELECT 1 FROM analysis_runs WHERE post_id = ${postId}::uuid) AS ok`);
    return rows[0]?.ok === true;
  }
}
