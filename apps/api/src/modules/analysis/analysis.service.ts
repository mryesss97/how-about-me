import { Inject, Injectable } from "@nestjs/common";
import type { AnalysisStatus, AnalysisTrigger } from "@how-about-me/contracts";
import { Prisma } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { AppError } from "../../common/errors/app.error";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import { TAXONOMY_VERSION } from "@how-about-me/taxonomy";
import { computeEffectiveVersion, type AnalysisEnqueuer, type EnqueueInput } from "./analysis-enqueuer";
import {
  CONTENT_CLASSIFIER,
  SAFETY_PROVIDER,
  type ContentClassifier,
  type SafetyProvider,
} from "./providers/interfaces";
import { AnalysisPolicyService } from "./settings/analysis-policy.service";

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
  | { created: true; runId: string; effectiveVersion: string }
  | { created: false; reason: "already_open" | "already_analyzed" };

export type RunUsage = { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number };

/** The 7 version fields stamped on `analysis_runs` when a run completes (BR-023, FR-110, TC-ANA-014). */
export type RunVersions = {
  classifierProvider: string;
  classifierModel: string;
  promptVersion: string;
  taxonomyVersion: string;
  safetyProvider: string;
  safetyModel: string;
  safetyPolicyVersion: string;
};

export type CompleteOptions = { versions?: RunVersions; skippedReason?: string };

type Db = Prisma.TransactionClient;

/** Triggers that bypass the "already completed" dedupe — doc 07 §7, FR-116. */
const FORCE_TRIGGERS: readonly AnalysisTrigger[] = ["manual", "retry"];

// Message kept stable: existing tests match /current effective_version/.
const refuseCurrentVersion = () =>
  new AppError("VALIDATION_ERROR", "markVersionStale: refusing to mark the current effective_version stale", {
    path: "version",
  });

/**
 * Analysis run lifecycle (T-070): enqueue with version dedupe, batch claiming, guarded transitions and
 * the stuck-run watchdog — docs/02-architecture/07-analysis-pipeline.md §1, §7, §8 (FR-100, FR-101, FR-116).
 * Every transition is a guarded UPDATE (`WHERE status = <from>`), matching `ANALYSIS_TRANSITIONS`.
 */
@Injectable()
export class AnalysisService implements AnalysisEnqueuer {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(CONTENT_CLASSIFIER) private readonly classifier: ContentClassifier,
    @Inject(SAFETY_PROVIDER) private readonly safety: SafetyProvider,
    private readonly policies: AnalysisPolicyService,
  ) {}

  /** BR-023 key for a given policy version, from the providers bound in this process. */
  effectiveVersionOf(safetyPolicyVersion: string): string {
    return computeEffectiveVersion(this.classifier, this.safety, safetyPolicyVersion);
  }

  /** BR-023: current effective_version of a project = bound providers + the project's active policy (FR-190). */
  async effectiveVersionFor(projectId: string, tx?: Db): Promise<string> {
    return this.effectiveVersionOf((await this.policies.active(projectId, tx)).policyVersion);
  }

  /** The 7 version fields for a run analysed under `safetyPolicyVersion` (same inputs as effectiveVersionOf). */
  runVersions(safetyPolicyVersion: string): RunVersions {
    return {
      classifierProvider: this.classifier.provider,
      classifierModel: this.classifier.model,
      promptVersion: this.classifier.promptVersion,
      taxonomyVersion: TAXONOMY_VERSION,
      safetyProvider: this.safety.name,
      safetyModel: this.safety.model,
      safetyPolicyVersion,
    };
  }

  async enqueue(tx: Db, input: EnqueueInput): Promise<boolean> {
    return (await this.enqueueDetailed(tx, input)).created;
  }

  /** [*] → pending. Returns why nothing was created so FR-115 can map it to `ANALYSIS_ALREADY_PENDING`. */
  async enqueueDetailed(tx: Db, input: EnqueueInput): Promise<EnqueueResult> {
    const force = FORCE_TRIGGERS.includes(input.trigger);
    // BR-023: read once per enqueue inside the caller's tx; a policy change only affects runs created after it.
    const ev = await this.effectiveVersionFor(input.projectId, tx);
    // FR-116: a completed run for the same (post, hash, version) suppresses enqueue unless forced.
    const completedGuard = force
      ? Prisma.empty
      : Prisma.sql`WHERE NOT EXISTS (
          SELECT 1 FROM analysis_runs
          WHERE post_id = ${input.postId}::uuid AND source_content_hash = ${input.contentHash}
            AND effective_version = ${ev} AND status = 'completed')`;
    // BR-024: the partial unique `analysis_runs_open_unique` blocks a second open run; the predicate
    // must be repeated in ON CONFLICT so Postgres can infer the partial index.
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO analysis_runs (id, post_id, project_id, status, trigger, source_content_hash, source_revision, effective_version, requested_by)
      SELECT ${uuidv7()}::uuid, ${input.postId}::uuid, ${input.projectId}::uuid, 'pending'::analysis_status,
             ${input.trigger}::analysis_trigger, ${input.contentHash}, ${input.revision}, ${ev},
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
          AND effective_version = ${ev} AND status IN ('pending', 'processing')`);
      return { created: false, reason: (done[0]?.n ?? 0) > 0 ? "already_open" : "already_analyzed" };
    }
    await tx.$executeRaw(
      Prisma.sql`UPDATE social_posts SET latest_run_status = 'pending' WHERE id = ${input.postId}::uuid`,
    );
    return { created: true, runId: created.id, effectiveVersion: ev };
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
   * Does not re-enqueue (the `mark-stale` endpoint uses `markVersionStaleInProject` + `enqueueMany`).
   * Throws when `oldVersion` is a current effective version, so current results are never staled: with
   * `projectId`, the project's current version; without it, the current version of any project (incl. v1 default).
   */
  async markVersionStale(
    oldVersion: string,
    opts: { projectId?: string } = {},
    tx: Db = this.prisma,
  ): Promise<{ marked: number }> {
    const current = opts.projectId
      ? new Set([await this.effectiveVersionFor(opts.projectId, tx)])
      : new Set([...(await this.policies.activePolicyVersions())].map((v) => this.effectiveVersionOf(v)));
    if (current.has(oldVersion)) throw refuseCurrentVersion();
    const projectFilter = opts.projectId ? Prisma.sql`AND project_id = ${opts.projectId}::uuid` : Prisma.empty;
    const { marked } = await this.staleVersionRuns(tx, oldVersion, projectFilter);
    return { marked };
  }

  /** T-145 mark-stale endpoint: like `markVersionStale` scoped to one project, also returns affected posts. */
  async markVersionStaleInProject(
    tx: Db,
    projectId: string,
    oldVersion: string,
  ): Promise<{ marked: number; postIds: string[] }> {
    await this.assertNotCurrentVersion(tx, projectId, oldVersion);
    return this.staleVersionRuns(tx, oldVersion, Prisma.sql`AND project_id = ${projectId}::uuid`);
  }

  /** 400 when `version` is the project's current effective_version (BR-023: never stale current results). */
  async assertNotCurrentVersion(tx: Db, projectId: string, version: string): Promise<void> {
    if ((await this.effectiveVersionFor(projectId, tx)) === version) throw refuseCurrentVersion();
  }

  /** Dry-run count for mark-stale: runs of `version` in the project that would become stale. */
  async countVersionRuns(tx: Db, projectId: string, version: string): Promise<number> {
    const rows = await tx.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT count(*)::int AS n FROM analysis_runs
      WHERE project_id = ${projectId}::uuid AND effective_version = ${version} AND status IN ('pending', 'completed')`);
    return rows[0]?.n ?? 0;
  }

  /**
   * Set-based enqueue for bulk re-analysis (T-145, FR-196). One effective_version read (BR-023), uuidv7 ids
   * generated in order (syncLatestStatus / setCurrentAnalysis rely on it). Skips posts with any open run
   * (FR-115) and, for non-force triggers, posts already completed for the same (hash, version) (BR-024, FR-116).
   */
  async enqueueMany(
    tx: Db,
    input: {
      projectId: string;
      posts: { postId: string; contentHash: string; revision: number }[];
      trigger: AnalysisTrigger;
      requestedBy?: string | null;
    },
  ): Promise<{ postIds: string[]; effectiveVersion: string }> {
    const ev = await this.effectiveVersionFor(input.projectId, tx);
    if (input.posts.length === 0) return { postIds: [], effectiveVersion: ev };
    const ids = input.posts.map(() => uuidv7());
    const postIds = input.posts.map((p) => p.postId);
    const hashes = input.posts.map((p) => p.contentHash);
    const revisions = input.posts.map((p) => p.revision);
    const completedGuard = FORCE_TRIGGERS.includes(input.trigger)
      ? Prisma.empty
      : Prisma.sql`AND NOT EXISTS (SELECT 1 FROM analysis_runs x
          WHERE x.post_id = u.post_id AND x.source_content_hash = u.hash
            AND x.effective_version = ${ev} AND x.status = 'completed')`;
    const rows = await tx.$queryRaw<{ post_id: string }[]>(Prisma.sql`
      INSERT INTO analysis_runs (id, post_id, project_id, status, trigger, source_content_hash, source_revision, effective_version, requested_by)
      SELECT u.id, u.post_id, ${input.projectId}::uuid, 'pending'::analysis_status, ${input.trigger}::analysis_trigger,
             u.hash, u.rev, ${ev}, ${input.requestedBy ?? null}::uuid
      FROM unnest(${ids}::uuid[], ${postIds}::uuid[], ${hashes}::text[], ${revisions}::int[]) AS u(id, post_id, hash, rev)
      WHERE NOT EXISTS (SELECT 1 FROM analysis_runs o
          WHERE o.post_id = u.post_id AND o.status IN ('pending', 'processing'))
        ${completedGuard}
      ORDER BY u.id
      ON CONFLICT (post_id, source_content_hash, effective_version) WHERE status IN ('pending', 'processing')
      DO NOTHING
      RETURNING post_id`);
    const created = rows.map((r) => r.post_id);
    if (created.length > 0) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE social_posts SET latest_run_status = 'pending' WHERE id = ANY(${created}::uuid[])`,
      );
    }
    return { postIds: created, effectiveVersion: ev };
  }

  private async staleVersionRuns(
    tx: Db,
    oldVersion: string,
    projectFilter: Prisma.Sql,
  ): Promise<{ marked: number; postIds: string[] }> {
    const rows = await tx.$queryRaw<{ n: number; post_ids: string[] | null }[]>(Prisma.sql`
      WITH c AS (
        UPDATE analysis_runs SET status = 'stale'
        WHERE effective_version = ${oldVersion} AND status IN ('pending', 'completed') ${projectFilter}
        RETURNING id, post_id),
      p AS (${this.syncLatestStatus(Prisma.sql`c`, Prisma.sql`'stale'::analysis_status`)})
      SELECT count(*)::int AS n, array_agg(DISTINCT post_id)::text[] AS post_ids FROM c`);
    return { marked: rows[0]?.n ?? 0, postIds: rows[0]?.post_ids ?? [] };
  }

  /**
   * pending → processing for up to `limit` runs, oldest first (FR-101). `FOR UPDATE SKIP LOCKED` lets
   * concurrent workers claim disjoint batches (TC-ANA-002). `opts.triggers` restricts the claim, e.g. the
   * daily budget pause only claims `manual` runs (doc 07 §9, T-075).
   */
  async claimBatch(
    workerId: string,
    limit: number,
    opts: { triggers?: readonly AnalysisTrigger[] } = {},
  ): Promise<ClaimedRun[]> {
    const triggerFilter =
      opts.triggers && opts.triggers.length > 0
        ? Prisma.sql`AND trigger IN (${Prisma.join(opts.triggers.map((t) => Prisma.sql`${t}::analysis_trigger`))})`
        : Prisma.empty;
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
          SELECT id FROM analysis_runs WHERE status = 'pending' ${triggerFilter}
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
  async markCompleted(
    runId: string,
    workerId: string,
    usage: RunUsage = {},
    tx: Db = this.prisma,
    opts: CompleteOptions = {},
  ): Promise<boolean> {
    const v = opts.versions;
    const versionSet = v
      ? Prisma.sql`, classifier_provider = ${v.classifierProvider}, classifier_model = ${v.classifierModel},
          prompt_version = ${v.promptVersion}, taxonomy_version = ${v.taxonomyVersion},
          safety_provider = ${v.safetyProvider}, safety_model = ${v.safetyModel},
          safety_policy_version = ${v.safetyPolicyVersion}`
      : Prisma.empty;
    // doc 07 §2: an irrelevant post completes with skipped_reason 'irrelevant'.
    const skipSet = opts.skippedReason ? Prisma.sql`, skipped_reason = ${opts.skippedReason}` : Prisma.empty;
    return (
      (await this.finish(
        tx,
        runId,
        workerId,
        Prisma.sql`status = 'completed', completed_at = now(), locked_at = NULL,
          input_tokens = ${usage.inputTokens ?? null}::int, output_tokens = ${usage.outputTokens ?? null}::int,
          estimated_cost_usd = ${usage.estimatedCostUsd ?? null}::numeric ${versionSet} ${skipSet}`,
      )) !== null
    );
  }

  /**
   * Points `social_posts.current_analysis_id` at `analysisId` unless a newer run (uuidv7 order) of the same
   * post already completed — a late-finishing older run never overwrites the newer pointer (FR-114).
   * Returns true when the pointer was updated.
   * The post row is locked first so two runs of the same post finishing concurrently serialize here: the
   * NOT EXISTS check below runs as a new statement after the lock, so it sees the other run's commit.
   */
  async setCurrentAnalysis(tx: Db, postId: string, runId: string, analysisId: string): Promise<boolean> {
    await tx.$queryRaw(Prisma.sql`SELECT 1 FROM social_posts WHERE id = ${postId}::uuid FOR UPDATE`);
    const n = await tx.$executeRaw(Prisma.sql`
      UPDATE social_posts SET current_analysis_id = ${analysisId}::uuid
      WHERE id = ${postId}::uuid
        AND NOT EXISTS (SELECT 1 FROM analysis_runs x
          WHERE x.post_id = ${postId}::uuid AND x.id > ${runId}::uuid AND x.status = 'completed')`);
    return n > 0;
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
   * (doc 07 §8). The worker sleeps the backoff before calling this (T-075). `message` is a short technical
   * reason, never post text. Returns the resulting status, or null if the run is no longer held by `workerId`.
   */
  async requeue(
    runId: string,
    workerId: string,
    code: string,
    message?: string,
    tx: Db = this.prisma,
  ): Promise<AnalysisStatus | null> {
    const max = this.cfg.ANALYSIS_MAX_ATTEMPTS;
    return this.finish(
      tx,
      runId,
      workerId,
      Prisma.sql`status = (CASE WHEN attempt_count >= ${max} THEN 'failed' ELSE 'pending' END)::analysis_status,
        error_code = ${code}, error_message = ${message ?? null},
        completed_at = CASE WHEN attempt_count >= ${max} THEN now() ELSE NULL END,
        locked_at = NULL, locked_by = NULL`,
    );
  }

  /**
   * processing → pending without consuming the attempt (doc 07 §8 auth pause, T-075): used for runs claimed
   * in a batch that the worker will not process. Returns false if the run is no longer held by `workerId`.
   */
  async release(runId: string, workerId: string, tx: Db = this.prisma): Promise<boolean> {
    return (
      (await this.finish(
        tx,
        runId,
        workerId,
        Prisma.sql`status = 'pending', attempt_count = GREATEST(attempt_count - 1, 0), started_at = NULL,
          locked_at = NULL, locked_by = NULL`,
      )) !== null
    );
  }

  /** System-wide count of `pending` / `processing` runs for `analysis_queue_depth` (FR-174, #310). */
  async queueDepth(): Promise<{ pending: number; processing: number }> {
    const rows = await this.prisma.$queryRaw<{ status: AnalysisStatus; n: number }[]>(Prisma.sql`
      SELECT status, count(*)::int AS n FROM analysis_runs
      WHERE status IN ('pending', 'processing') GROUP BY status`);
    const count = (s: AnalysisStatus) => rows.find((r) => r.status === s)?.n ?? 0;
    return { pending: count("pending"), processing: count("processing") };
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
