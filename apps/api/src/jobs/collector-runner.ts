/**
 * DI token for the per-query run implementation, bound to `CollectorService` (T-052). With no runner bound
 * (tests may override it with `null`) the tick never starts, so no query is claimed.
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
  /** Worker holding the lock (`locked_by`); the runner guards its own `listening_queries` writes with it. */
  workerId: string;
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
