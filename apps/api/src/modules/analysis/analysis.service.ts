import { Inject, Injectable } from "@nestjs/common";
import type { AnalysisStatus, AnalysisTrigger } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import { computeEffectiveVersion, type AnalysisEnqueuer, type EnqueueInput } from "./analysis-enqueuer";
import {
  CONTENT_CLASSIFIER,
  SAFETY_PROVIDER,
  type ContentClassifier,
  type SafetyProvider,
} from "./providers/interfaces";

/** A run claimed by a worker (`status='processing'`, `locked_by=workerId`). */
export type ClaimedRun = {
  id: string;
  postId: string;
  projectId: string;
  trigger: AnalysisTrigger;
  sourceContentHash: string;
  sourceRevision: number;
  effectiveVersion: string;
  attemptCount: number;
  lockedBy: string;
};

export type EnqueueResult =
  { created: true; runId: string } | { created: false; reason: "already_open" | "already_analyzed" };

export type RunUsage = { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number };

type Db = Prisma.TransactionClient;

/** Triggers that bypass the "already completed" dedupe — doc 07 §7, FR-116. */
const FORCE_TRIGGERS: readonly AnalysisTrigger[] = ["manual", "retry"];

/**
 * Analysis run lifecycle (T-070): enqueue with version dedupe, batch claiming, guarded transitions and
 * the stuck-run watchdog — docs/02-architecture/07-analysis-pipeline.md §1, §7, §8 (FR-100, FR-101, FR-116).
 * Every transition is a guarded UPDATE (`WHERE status = <from>`), matching `ANALYSIS_TRANSITIONS`.
 */
@Injectable()
export class AnalysisService implements AnalysisEnqueuer {
  readonly effectiveVersion: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(CONTENT_CLASSIFIER) classifier: ContentClassifier,
    @Inject(SAFETY_PROVIDER) safety: SafetyProvider,
  ) {
    // BR-023: computed once per process from the bound providers.
    this.effectiveVersion = computeEffectiveVersion(classifier, safety);
  }

  async enqueue(tx: Db, input: EnqueueInput): Promise<boolean> {
    return (await this.enqueueDetailed(tx, input)).created;
  }

  /** [*] → pending. Returns why nothing was created so FR-115 can map it to `ANALYSIS_ALREADY_PENDING`. */
  async enqueueDetailed(tx: Db, input: EnqueueInput): Promise<EnqueueResult> {
    const force = FORCE_TRIGGERS.includes(input.trigger);
    // FR-116: a completed run for the same (post, hash, version) suppresses enqueue unless forced.
    const completedGuard = force
      ? Prisma.empty
      : Prisma.sql`WHERE NOT EXISTS (
          SELECT 1 FROM analysis_runs
          WHERE post_id = ${input.postId}::uuid AND source_content_hash = ${input.contentHash}
            AND effective_version = ${this.effectiveVersion} AND status = 'completed')`;
    // BR-024: the partial unique `analysis_runs_open_unique` blocks a second open run; the predicate
    // must be repeated in ON CONFLICT so Postgres can infer the partial index.
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO analysis_runs (id, post_id, project_id, status, trigger, source_content_hash, source_revision, effective_version, requested_by)
      SELECT ${uuidv7()}::uuid, ${input.postId}::uuid, ${input.projectId}::uuid, 'pending'::analysis_status,
             ${input.trigger}::analysis_trigger, ${input.contentHash}, ${input.revision}, ${this.effectiveVersion},
             ${input.requestedBy ?? null}::uuid
      ${completedGuard}
      ON CONFLICT (post_id, source_content_hash, effective_version) WHERE status IN ('pending', 'processing')
      DO NOTHING
      RETURNING id`);
    const created = rows[0];
    if (!created) {
      // Best-effort reason (a concurrent transition between the two statements can flip it); FR-115
      // should re-check when it maps this to `ANALYSIS_ALREADY_PENDING`.
      const done = await tx.$queryRaw<{ n: number }[]>(Prisma.sql`
        SELECT count(*)::int AS n FROM analysis_runs
        WHERE post_id = ${input.postId}::uuid AND source_content_hash = ${input.contentHash}
          AND effective_version = ${this.effectiveVersion} AND status IN ('pending', 'processing')`);
      return { created: false, reason: (done[0]?.n ?? 0) > 0 ? "already_open" : "already_analyzed" };
    }
    await tx.$executeRaw(
      Prisma.sql`UPDATE social_posts SET latest_run_status = 'pending' WHERE id = ${input.postId}::uuid`,
    );
    return { created: true, runId: created.id };
  }

  /**
   * pending|completed → stale for older content hashes (FR-078, FR-100, BR-003). `processing` runs are left
   * alone; the processor marks them `skipped superseded` (doc 07 §1). Returns the number of runs marked.
   */
  async markCurrentStale(tx: Db, postId: string, newHash: string): Promise<number> {
    const rows = await tx.$queryRaw<{ n: number }[]>(Prisma.sql`
      WITH c AS (
        UPDATE analysis_runs SET status = 'stale'
        WHERE post_id = ${postId}::uuid AND status IN ('pending', 'completed') AND source_content_hash <> ${newHash}
        RETURNING id, post_id),
      p AS (${this.syncLatestStatus(Prisma.sql`c`, Prisma.sql`'stale'::analysis_status`)})
      SELECT count(*)::int AS n FROM c`);
    return rows[0]?.n ?? 0;
  }

  /**
   * Version change helper (doc 07 §7, BR-023, FR-100): pending|completed runs of `oldVersion` → stale.
   * Does not re-enqueue (bulk enqueue within caps and the `mark-stale` endpoint are P1).
   * Throws when `oldVersion` is the current effective version, so current results are never staled.
   */
  async markVersionStale(
    oldVersion: string,
    opts: { projectId?: string } = {},
    tx: Db = this.prisma,
  ): Promise<{ marked: number }> {
    if (oldVersion === this.effectiveVersion) {
      throw new Error("markVersionStale: refusing to mark the current effective_version stale");
    }
    const projectFilter = opts.projectId ? Prisma.sql`AND project_id = ${opts.projectId}::uuid` : Prisma.empty;
    const rows = await tx.$queryRaw<{ n: number }[]>(Prisma.sql`
      WITH c AS (
        UPDATE analysis_runs SET status = 'stale'
        WHERE effective_version = ${oldVersion} AND status IN ('pending', 'completed') ${projectFilter}
        RETURNING id, post_id),
      p AS (${this.syncLatestStatus(Prisma.sql`c`, Prisma.sql`'stale'::analysis_status`)})
      SELECT count(*)::int AS n FROM c`);
    return { marked: rows[0]?.n ?? 0 };
  }

  /**
   * pending → processing for up to `limit` runs, oldest first (FR-101). `FOR UPDATE SKIP LOCKED` lets
   * concurrent workers claim disjoint batches (TC-ANA-002).
   */
  async claimBatch(workerId: string, limit: number): Promise<ClaimedRun[]> {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        post_id: string;
        project_id: string;
        trigger: AnalysisTrigger;
        source_content_hash: string;
        source_revision: number;
        effective_version: string;
        attempt_count: number;
      }[]
    >(Prisma.sql`
      WITH c AS (
        UPDATE analysis_runs r
        SET status = 'processing', locked_at = now(), locked_by = ${workerId}, started_at = now(),
            attempt_count = r.attempt_count + 1
        WHERE r.id IN (
          SELECT id FROM analysis_runs WHERE status = 'pending'
          ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED)
        RETURNING r.id, r.post_id, r.project_id, r.trigger, r.source_content_hash, r.source_revision,
                  r.effective_version, r.attempt_count, r.created_at),
      p AS (${this.syncLatestStatus(Prisma.sql`c`, Prisma.sql`'processing'::analysis_status`)})
      SELECT id, post_id, project_id, trigger, source_content_hash, source_revision, effective_version, attempt_count
      FROM c ORDER BY created_at`);
    return rows.map((r) => ({
      id: r.id,
      postId: r.post_id,
      projectId: r.project_id,
      trigger: r.trigger,
      sourceContentHash: r.source_content_hash,
      sourceRevision: r.source_revision,
      effectiveVersion: r.effective_version,
      attemptCount: r.attempt_count,
      lockedBy: workerId,
    }));
  }

  /** processing → completed. Returns false if the run is no longer held by `workerId` (watchdog race). */
  async markCompleted(runId: string, workerId: string, usage: RunUsage = {}, tx: Db = this.prisma): Promise<boolean> {
    return (
      (await this.finish(
        tx,
        runId,
        workerId,
        Prisma.sql`status = 'completed', completed_at = now(), locked_at = NULL,
          input_tokens = ${usage.inputTokens ?? null}::int, output_tokens = ${usage.outputTokens ?? null}::int,
          estimated_cost_usd = ${usage.estimatedCostUsd ?? null}::numeric`,
      )) !== null
    );
  }

  /** processing → skipped (e.g. `empty_text`, `superseded`). */
  async markSkipped(runId: string, workerId: string, reason: string, tx: Db = this.prisma): Promise<boolean> {
    return (
      (await this.finish(
        tx,
        runId,
        workerId,
        Prisma.sql`status = 'skipped', skipped_reason = ${reason}, completed_at = now(), locked_at = NULL`,
      )) !== null
    );
  }

  /** processing → failed. `message` must be a short technical reason, never post text. */
  async markFailed(
    runId: string,
    workerId: string,
    code: string,
    message: string,
    tx: Db = this.prisma,
  ): Promise<boolean> {
    return (
      (await this.finish(
        tx,
        runId,
        workerId,
        Prisma.sql`status = 'failed', error_code = ${code}, error_message = ${message}, completed_at = now(), locked_at = NULL`,
      )) !== null
    );
  }

  /**
   * processing → pending (transient error), or → failed once `attempt_count >= ANALYSIS_MAX_ATTEMPTS`
   * (doc 07 §8). Re-queue is immediate; backoff (2 s × 2^attempt) is left to T-074/T-075.
   * Returns the resulting status, or null if the run is no longer held by `workerId`.
   */
  async requeue(runId: string, workerId: string, code: string, tx: Db = this.prisma): Promise<AnalysisStatus | null> {
    const max = this.cfg.ANALYSIS_MAX_ATTEMPTS;
    return this.finish(
      tx,
      runId,
      workerId,
      Prisma.sql`status = (CASE WHEN attempt_count >= ${max} THEN 'failed' ELSE 'pending' END)::analysis_status,
        error_code = ${code},
        completed_at = CASE WHEN attempt_count >= ${max} THEN now() ELSE NULL END,
        locked_at = NULL, locked_by = NULL`,
    );
  }

  /**
   * Watchdog (doc 07 §8, TC-ANA-003): runs stuck in `processing` longer than `ANALYSIS_STUCK_MINUTES`
   * go back to `pending` with the lock cleared; runs that already used all attempts become `failed`
   * (`ANALYSIS_PROVIDER_ERROR`, `stuck_processing_timeout`) to avoid an endless loop.
   * Safe w.r.t. BR-024: `processing` and `pending` share the partial unique, so no duplicate can appear.
   */
  async requeueStuck(
    olderThanMinutes = this.cfg.ANALYSIS_STUCK_MINUTES,
  ): Promise<{ requeued: number; failed: number }> {
    const max = this.cfg.ANALYSIS_MAX_ATTEMPTS;
    const rows = await this.prisma.$queryRaw<{ status: AnalysisStatus; n: number }[]>(Prisma.sql`
      WITH c AS (
        UPDATE analysis_runs r
        SET status = (CASE WHEN r.attempt_count >= ${max} THEN 'failed' ELSE 'pending' END)::analysis_status,
            error_code = CASE WHEN r.attempt_count >= ${max} THEN 'ANALYSIS_PROVIDER_ERROR' ELSE r.error_code END,
            error_message = CASE WHEN r.attempt_count >= ${max} THEN 'stuck_processing_timeout' ELSE r.error_message END,
            completed_at = CASE WHEN r.attempt_count >= ${max} THEN now() ELSE NULL END,
            locked_at = NULL, locked_by = NULL
        WHERE r.status = 'processing' AND r.locked_at < now() - make_interval(mins => ${olderThanMinutes}::int)
        RETURNING r.id, r.post_id, r.status),
      p AS (${this.syncLatestStatus(Prisma.sql`c`, Prisma.sql`c.status`)})
      SELECT status, count(*)::int AS n FROM c GROUP BY status`);
    const count = (s: AnalysisStatus) => rows.find((r) => r.status === s)?.n ?? 0;
    return { requeued: count("pending"), failed: count("failed") };
  }

  /**
   * Guarded transition out of `processing` held by `workerId`; also syncs `social_posts.latest_run_status`.
   * Terminal transitions clear `locked_at` but keep `locked_by` as an audit trail of the finishing worker;
   * transitions back to `pending` clear both so the run can be claimed again.
   */
  private async finish(db: Db, runId: string, workerId: string, set: Prisma.Sql): Promise<AnalysisStatus | null> {
    const rows = await db.$queryRaw<{ status: AnalysisStatus }[]>(Prisma.sql`
      WITH c AS (
        UPDATE analysis_runs SET ${set}
        WHERE id = ${runId}::uuid AND status = 'processing' AND locked_by = ${workerId}
        RETURNING id, post_id, status),
      p AS (${this.syncLatestStatus(Prisma.sql`c`, Prisma.sql`c.status`)})
      SELECT status FROM c`);
    return rows[0]?.status ?? null;
  }

  /** Updates `latest_run_status` only when the changed run is the post's newest run (uuidv7 ids sort by time). */
  private syncLatestStatus(cte: Prisma.Sql, status: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`
      UPDATE social_posts s SET latest_run_status = ${status}
      FROM ${cte}
      WHERE s.id = c.post_id
        AND NOT EXISTS (SELECT 1 FROM analysis_runs x WHERE x.post_id = c.post_id AND x.id > c.id)`;
  }
}
