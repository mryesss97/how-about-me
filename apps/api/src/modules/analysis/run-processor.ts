import type { ClaimedRun } from "./analysis.service";

/**
 * Port for processing one claimed run (relevance → safety → classify → persist). The real
 * implementation is T-074; until it is bound the worker does not poll (doc 07 §2).
 * The processor must finish the run through `AnalysisService` transitions (markCompleted / markSkipped /
 * markFailed / requeue). If it throws, the worker re-queues the run.
 */
export const ANALYSIS_RUN_PROCESSOR = Symbol("ANALYSIS_RUN_PROCESSOR");

export interface RunProcessor {
  process(run: ClaimedRun): Promise<void>;
}
