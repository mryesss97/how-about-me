import { randomUUID } from "node:crypto";
import type { Platform, Prisma, PrismaClient } from "@prisma/client";
import type { AuditService } from "../audit/audit.service";

/**
 * Retention / purge core (T-126, NFR-054, NFR-072) — docs/05-operations/04-data-retention-purge.md §2.
 * Pure data logic taking a Prisma client so the CLI (`src/cli/purge.ts`) and the scheduled job (T-153) share it.
 * `audit_logs` and `analytics_daily` are never touched (doc §1).
 */
export type PurgeScope =
  | { scope: "post"; platform: Platform; platformPostId: string }
  | { scope: "project"; projectId: string; before: Date }
  | { scope: "sync-jobs"; before: Date; projectId?: string };

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
export type PurgeCounts = PostPurgeCounts | SyncJobPurgeCounts;

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

function postWhere(s: Exclude<PurgeScope, { scope: "sync-jobs" }>): Prisma.SocialPostWhereInput {
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
