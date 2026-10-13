import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SAFETY_POLICY_VERSION, TAXONOMY_VERSION } from "@how-about-me/taxonomy";
import { v7 as uuidv7 } from "uuid";
import {
  CONTENT_CLASSIFIER,
  SAFETY_PROVIDER,
  type ContentClassifier,
  type SafetyProvider,
} from "./providers/interfaces";

/**
 * Port for creating analysis runs from ingestion (T-051). T-070 replaces `SqlAnalysisEnqueuer` with
 * `AnalysisService`; the interface stays — docs/02-architecture/07-analysis-pipeline.md §7.
 */
export const ANALYSIS_ENQUEUER = Symbol("ANALYSIS_ENQUEUER");

export type EnqueueTrigger = "ingest" | "content_change";
export type EnqueueInput = {
  postId: string;
  projectId: string;
  contentHash: string;
  revision: number;
  trigger: EnqueueTrigger;
};

export interface AnalysisEnqueuer {
  /** Returns true when a new `pending` run was created. */
  enqueue(tx: Prisma.TransactionClient, input: EnqueueInput): Promise<boolean>;
  /** Marks `pending`/`completed` runs of an older content hash as `stale` (FR-078). */
  markCurrentStale(tx: Prisma.TransactionClient, postId: string, newHash: string): Promise<void>;
}

/** effective_version formula — doc 07 §7 (BR-023). */
export function computeEffectiveVersion(classifier: ContentClassifier, safety: SafetyProvider): string {
  return [
    classifier.provider,
    classifier.model,
    classifier.promptVersion,
    TAXONOMY_VERSION,
    safety.name,
    safety.model,
    SAFETY_POLICY_VERSION,
  ].join("|");
}

@Injectable()
export class SqlAnalysisEnqueuer implements AnalysisEnqueuer {
  readonly effectiveVersion: string;

  constructor(
    @Inject(CONTENT_CLASSIFIER) classifier: ContentClassifier,
    @Inject(SAFETY_PROVIDER) safety: SafetyProvider,
  ) {
    this.effectiveVersion = computeEffectiveVersion(classifier, safety);
  }

  async enqueue(tx: Prisma.TransactionClient, input: EnqueueInput): Promise<boolean> {
    // BR-024: the partial unique `analysis_runs_open_unique` blocks a second open run; the predicate
    // must be repeated in ON CONFLICT so Postgres can infer the partial index. A completed run for the
    // same (post, hash, version) also suppresses enqueue (doc 07 §7, trigger ≠ manual).
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      INSERT INTO analysis_runs (id, post_id, project_id, status, trigger, source_content_hash, source_revision, effective_version)
      SELECT ${uuidv7()}::uuid, ${input.postId}::uuid, ${input.projectId}::uuid, 'pending'::analysis_status,
             ${input.trigger}::analysis_trigger, ${input.contentHash}, ${input.revision}, ${this.effectiveVersion}
      WHERE NOT EXISTS (
        SELECT 1 FROM analysis_runs
        WHERE post_id = ${input.postId}::uuid AND source_content_hash = ${input.contentHash}
          AND effective_version = ${this.effectiveVersion} AND status = 'completed'
      )
      ON CONFLICT (post_id, source_content_hash, effective_version) WHERE status IN ('pending', 'processing')
      DO NOTHING
      RETURNING id`);
    if (rows.length === 0) return false;
    await tx.$executeRaw(
      Prisma.sql`UPDATE social_posts SET latest_run_status = 'pending' WHERE id = ${input.postId}::uuid`,
    );
    return true;
  }

  async markCurrentStale(tx: Prisma.TransactionClient, postId: string, newHash: string): Promise<void> {
    await tx.$executeRaw(Prisma.sql`
      UPDATE analysis_runs SET status = 'stale'
      WHERE post_id = ${postId}::uuid AND status IN ('pending', 'completed') AND source_content_hash <> ${newHash}`);
  }
}
