import type { AnalysisTrigger } from "@how-about-me/contracts";
import type { Prisma } from "@prisma/client";
import { SAFETY_POLICY_VERSION, TAXONOMY_VERSION } from "@how-about-me/taxonomy";
import type { ContentClassifier, SafetyProvider } from "./providers/interfaces";

/**
 * Port for creating analysis runs from ingestion (T-051), implemented by `AnalysisService` (T-070) —
 * docs/02-architecture/07-analysis-pipeline.md §7.
 */
export const ANALYSIS_ENQUEUER = Symbol("ANALYSIS_ENQUEUER");

export type EnqueueTrigger = AnalysisTrigger;
export type EnqueueInput = {
  postId: string;
  projectId: string;
  contentHash: string;
  revision: number;
  trigger: EnqueueTrigger;
  requestedBy?: string;
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
