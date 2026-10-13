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
  /** Marks `pending`/`completed` runs of an older content hash as `stale` (FR-078); returns the count. */
  markCurrentStale(tx: Prisma.TransactionClient, postId: string, newHash: string): Promise<number>;
}

/**
 * effective_version formula — doc 07 §7 (BR-023). The last segment is the project's analysis policy version
 * (FR-190); defaults to v1 for callers without a project (eval).
 */
export function computeEffectiveVersion(
  classifier: ContentClassifier,
  safety: SafetyProvider,
  safetyPolicyVersion: string = SAFETY_POLICY_VERSION,
): string {
  return [
    classifier.provider,
    classifier.model,
    classifier.promptVersion,
    TAXONOMY_VERSION,
    safety.name,
    safety.model,
    safetyPolicyVersion,
  ].join("|");
}

/**
 * Policy version recorded in an effective_version (last `|` segment). Assumes provider/model names never
 * contain `|` (true for every bound provider).
 */
export function policyVersionOfEffective(effectiveVersion: string): string {
  return effectiveVersion.slice(effectiveVersion.lastIndexOf("|") + 1);
}
