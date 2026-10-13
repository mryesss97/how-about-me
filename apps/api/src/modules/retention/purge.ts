import { randomUUID } from "node:crypto";
import { Prisma, type Platform, type PrismaClient } from "@prisma/client";
import type { AuditService } from "../audit/audit.service";

/**
 * Retention / purge core (T-126, NFR-054, NFR-072) — docs/05-operations/04-data-retention-purge.md §2.
 * Pure data logic taking a Prisma client so the CLI (`src/cli/purge.ts`) and the scheduled job (T-153) share it.
 * `audit_logs` and `analytics_daily` are never touched (doc §1).
 */
export type PurgeScope =
  | { scope: "post"; platform: Platform; platformPostId: string }
  | { scope: "project"; projectId: string; before: Date }
  | { scope: "sync-jobs"; before: Date; projectId?: string }
  /** Non-current analysis history (T-153, RETENTION_RUNS_DAYS); see `eligibleRunsSql`. */
  | { scope: "runs"; before: Date; projectId?: string };

export type PostPurgeCounts = {
  posts: number;
  matches: number;
  overrides: number;
  intents: number;
  topics: number;
  analyses: number;
  runs: number;
};
export type SyncJobPurgeCounts = { syncJobs: number };
export type RunPurgeCounts = { runs: number; analyses: number; intents: number; topics: number };
export type PurgeCounts = PostPurgeCounts | SyncJobPurgeCounts | RunPurgeCounts;

export const DEFAULT_PURGE_BATCH_SIZE = 1000;
export const MAX_PURGE_BATCH_SIZE = 5000;
/** Sync jobs still in flight are never purged. */
const ACTIVE_JOB_STATUSES = ["queued", "running"] as const;
/** A full batch (1 000 posts + children) can exceed Prisma's 5 s interactive-transaction default. */
const PURGE_TX_OPTIONS = { maxWait: 10_000, timeout: 120_000 } as const;

const emptyPostCounts = (): PostPurgeCounts => ({
  posts: 0,
  matches: 0,
  overrides: 0,
  intents: 0,
  topics: 0,
  analyses: 0,
  runs: 0,
});

type PostScope = Extract<PurgeScope, { scope: "post" | "project" }>;
type RunScope = Extract<PurgeScope, { scope: "runs" }>;

/**
 * Runs eligible for history purge (T-153 decision 3). A run is deleted only when all hold:
 * (a) created_at < before; (b) status not pending/processing; (c) its analysis (if any) is neither a post's
 * current_analysis_id nor referenced by any override; (d) the post has a newer run by (created_at, id),
 * so the latest run per post is always kept. `onlyIds` re-checks a batch inside the delete transaction.
 */
function eligibleRunsSql(s: RunScope, opts: { onlyIds?: string[]; limit?: number } = {}): Prisma.Sql {
  return Prisma.sql`
    SELECT r.id FROM analysis_runs r
    WHERE r.created_at < ${s.before}
      AND r.status::text NOT IN ('pending', 'processing')
      ${s.projectId ? Prisma.sql`AND r.project_id = ${s.projectId}::uuid` : Prisma.empty}
      ${opts.onlyIds ? Prisma.sql`AND r.id = ANY(${opts.onlyIds}::uuid[])` : Prisma.empty}
      AND EXISTS (
        SELECT 1 FROM analysis_runs n
        WHERE n.post_id = r.post_id AND (n.created_at, n.id) > (r.created_at, r.id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM post_analyses a JOIN social_posts p ON p.current_analysis_id = a.id
        WHERE a.analysis_run_id = r.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM post_analyses a JOIN analysis_overrides o ON o.analysis_id = a.id
        WHERE a.analysis_run_id = r.id
      )
    ${opts.limit ? Prisma.sql`ORDER BY r.id LIMIT ${opts.limit}` : Prisma.empty}`;
}

async function countRuns(prisma: PrismaClient, s: RunScope): Promise<RunPurgeCounts> {
  const rows = await prisma.$queryRaw<{ runs: bigint; analyses: bigint; intents: bigint; topics: bigint }[]>(
    Prisma.sql`
      WITH e AS (${eligibleRunsSql(s)}),
           an AS (SELECT a.id FROM post_analyses a JOIN e ON e.id = a.analysis_run_id)
      SELECT (SELECT count(*) FROM e) AS runs,
             (SELECT count(*) FROM an) AS analyses,
             (SELECT count(*) FROM analysis_intents i JOIN an ON an.id = i.analysis_id) AS intents,
             (SELECT count(*) FROM analysis_topics t JOIN an ON an.id = t.analysis_id) AS topics`,
  );
  const r = rows[0];
  return {
    runs: Number(r?.runs ?? 0),
    analyses: Number(r?.analyses ?? 0),
    intents: Number(r?.intents ?? 0),
    topics: Number(r?.topics ?? 0),
  };
}

function postWhere(s: PostScope): Prisma.SocialPostWhereInput {
  if (s.scope === "post") return { platform: s.platform, platformPostId: s.platformPostId };
  // `before` is exclusive: published_at < before (UTC).
  return { projectId: s.projectId, publishedAt: { lt: s.before } };
}

function syncJobWhere(s: Extract<PurgeScope, { scope: "sync-jobs" }>): Prisma.SyncJobWhereInput {
  return {
    createdAt: { lt: s.before },
    status: { notIn: [...ACTIVE_JOB_STATUSES] },
    ...(s.projectId ? { projectId: s.projectId } : {}),
  };
}

/** Dry-run counts per table; must equal what `applyPurge` deletes on unchanged data (T-126 AC). */
export async function countPurge(prisma: PrismaClient, s: PurgeScope): Promise<PurgeCounts> {
  if (s.scope === "sync-jobs") return { syncJobs: await prisma.syncJob.count({ where: syncJobWhere(s) }) };
  if (s.scope === "runs") return countRuns(prisma, s);
  const post = postWhere(s);
  const [posts, matches, overrides, intents, topics, analyses, runs] = await Promise.all([
    prisma.socialPost.count({ where: post }),
    prisma.postQueryMatch.count({ where: { post } }),
    prisma.analysisOverride.count({ where: { post } }),
    prisma.analysisIntent.count({ where: { analysis: { post } } }),
    prisma.analysisTopic.count({ where: { analysis: { post } } }),
    prisma.postAnalysis.count({ where: { post } }),
    prisma.analysisRun.count({ where: { post } }),
  ]);
  return { posts, matches, overrides, intents, topics, analyses, runs };
}

export type ApplyPurgeOptions = {
  batchSize?: number;
  actorUserId?: string | null;
  /** Shared by every batch's audit row so one run can be grouped; defaults to a fresh uuid. */
  requestId?: string;
};

/**
 * Deletes in batches. Each batch runs in one transaction together with its `data.purged` audit row,
 * so deleted data and audit always go together (an audit failure rolls the batch back).
 * Empty batches write no audit; re-running is idempotent (0 rows, no audit).
 */
export async function applyPurge(
  prisma: PrismaClient,
  audit: AuditService,
  s: PurgeScope,
  opts: ApplyPurgeOptions = {},
): Promise<PurgeCounts> {
  const batchSize = Math.min(Math.max(1, opts.batchSize ?? DEFAULT_PURGE_BATCH_SIZE), MAX_PURGE_BATCH_SIZE);
  const requestId = opts.requestId ?? randomUUID();
  const actorUserId = opts.actorUserId ?? null;
  const before = s.scope === "post" ? undefined : s.before.toISOString();

  if (s.scope === "sync-jobs") {
    let syncJobs = 0;
    for (;;) {
      const ids = (
        await prisma.syncJob.findMany({
          where: syncJobWhere(s),
          select: { id: true },
          orderBy: { id: "asc" },
          take: batchSize,
        })
      ).map((r) => r.id);
      if (ids.length === 0) break;
      const n = await prisma.$transaction(async (tx) => {
        const { count } = await tx.syncJob.deleteMany({ where: { id: { in: ids } } });
        if (count === 0) return 0; // rows removed concurrently: nothing to audit (T-153 decision 5)
        await audit.record(
          {
            projectId: s.projectId ?? null,
            actorUserId,
            action: "data.purged",
            entityType: "sync_job",
            metadata: { scope: "sync-jobs", count, counts: { syncJobs: count }, before },
            requestId,
          },
          tx,
        );
        return count;
      }, PURGE_TX_OPTIONS);
      syncJobs += n;
    }
    return { syncJobs };
  }

  if (s.scope === "runs") {
    const total: RunPurgeCounts = { runs: 0, analyses: 0, intents: 0, topics: 0 };
    for (;;) {
      const ids = (await prisma.$queryRaw<{ id: string }[]>(eligibleRunsSql(s, { limit: batchSize }))).map((r) => r.id);
      if (ids.length === 0) break;
      const c = await prisma.$transaction(async (tx) => {
        // Re-check eligibility inside the transaction (a run may have become current meanwhile).
        const ok = (await tx.$queryRaw<{ id: string }[]>(eligibleRunsSql(s, { onlyIds: ids }))).map((r) => r.id);
        const b: RunPurgeCounts = { runs: 0, analyses: 0, intents: 0, topics: 0 };
        if (ok.length === 0) return b;
        const inRuns = { analysisRunId: { in: ok } };
        b.intents = (await tx.analysisIntent.deleteMany({ where: { analysis: inRuns } })).count;
        b.topics = (await tx.analysisTopic.deleteMany({ where: { analysis: inRuns } })).count;
        b.analyses = (await tx.postAnalysis.deleteMany({ where: inRuns })).count;
        b.runs = (await tx.analysisRun.deleteMany({ where: { id: { in: ok } } })).count;
        if (b.runs === 0) return b;
        await audit.record(
          {
            projectId: s.projectId ?? null,
            actorUserId,
            action: "data.purged",
            entityType: "analysis_run",
            metadata: { scope: "runs", count: b.runs, counts: b, before },
            requestId,
          },
          tx,
        );
        return b;
      }, PURGE_TX_OPTIONS);
      if (c.runs === 0) break; // nothing deletable left in this batch; avoid spinning
      for (const k of Object.keys(total) as (keyof RunPurgeCounts)[]) total[k] += c[k];
    }
    return total;
  }

  const total = emptyPostCounts();
  const where = postWhere(s);
  for (;;) {
    const rows = await prisma.socialPost.findMany({
      where,
      select: { id: true, projectId: true },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    const batch = await prisma.$transaction(async (tx) => {
      const inIds = { postId: { in: ids } };
      // Explicit order (FKs would cascade anyway) so per-table counts are exact.
      // Overrides go before analyses so their SetNull on analysis_id never fires.
      const c = emptyPostCounts();
      c.matches = (await tx.postQueryMatch.deleteMany({ where: inIds })).count;
      c.overrides = (await tx.analysisOverride.deleteMany({ where: inIds })).count;
      c.intents = (await tx.analysisIntent.deleteMany({ where: { analysis: inIds } })).count;
      c.topics = (await tx.analysisTopic.deleteMany({ where: { analysis: inIds } })).count;
      c.analyses = (await tx.postAnalysis.deleteMany({ where: inIds })).count;
      c.runs = (await tx.analysisRun.deleteMany({ where: inIds })).count;
      c.posts = (await tx.socialPost.deleteMany({ where: { id: { in: ids } } })).count;
      if (c.posts === 0) return c; // rows removed concurrently: nothing to audit (T-153 decision 5)
      const projectIds = [...new Set(rows.map((r) => r.projectId))];
      await audit.record(
        {
          projectId: projectIds.length === 1 ? (projectIds[0] ?? null) : null,
          actorUserId,
          action: "data.purged",
          entityType: "social_post",
          entityId: s.scope === "post" ? (ids[0] ?? null) : null,
          metadata: {
            scope: s.scope,
            count: c.posts,
            counts: c,
            ...(before ? { before } : {}),
            ...(s.scope === "post" ? { platformPostId: s.platformPostId } : {}),
          },
          requestId,
        },
        tx,
      );
      return c;
    }, PURGE_TX_OPTIONS);
    for (const k of Object.keys(total) as (keyof PostPurgeCounts)[]) total[k] += batch[k];
  }
  return total;
}
