/**
 * DI token for the per-query run implementation. SchedulerModule binds it to `null` until T-052 rebinds it
 * to CollectorService; with no runner bound the tick never starts, so no query is claimed and no
 * `next_run_at` / `last_run_at` is advanced by a run that did not happen.
 */
export const COLLECTOR_RUNNER = Symbol("COLLECTOR_RUNNER");

/** A listening query claimed by this worker (FR-086). */
export interface ClaimedQuery {
  id: string;
  projectId: string;
  pollIntervalSeconds: number;
  consecutiveFailures: number;
  nextRunAt: Date | null;
  /** Oldest queued manual job for this query, if any (FR-058, processed ahead of scheduled). */
  manualJobId: string | null;
}

export type RunStatus = "success" | "partial" | "failed";

export interface RunOutcome {
  status: RunStatus;
  completedAt: Date;
  errorCode?: string;
  errorMessage?: string;
}

export interface CollectorRunner {
  run(query: ClaimedQuery, signal?: AbortSignal): Promise<RunOutcome>;
}
