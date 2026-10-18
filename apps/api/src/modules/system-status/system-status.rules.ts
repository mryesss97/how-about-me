/** Pure status rules for `GET /projects/:projectId/system-status` — docs/02-architecture/09-observability.md §4. */

export type CollectorStatus = "healthy" | "degraded" | "paused";

/** Below this 24h success rate the collector is `degraded` (doc 09 §4). */
export const SUCCESS_RATE_DEGRADED_BELOW = 0.8;
/** Lag above this multiple of the max poll interval is `degraded` (doc 09 §4). */
export const LAG_POLL_MULTIPLIER = 3;

/** FR-176: seconds since the latest successful sync across enabled queries; null when none has ever synced. */
export function computeCollectionLagSeconds(lastSyncs: readonly (Date | null)[], now: Date): number | null {
  let max: number | null = null;
  for (const d of lastSyncs) if (d && (max === null || d.getTime() > max)) max = d.getTime();
  if (max === null) return null;
  return Math.max(0, Math.floor((now.getTime() - max) / 1000));
}

export type JobCounts = { success: number; partial: number; failed: number };

/** (success + partial) / (success + partial + failed); cancelled/queued/running excluded; empty sample → null. */
export function computeSuccessRate(c: JobCounts): number | null {
  const total = c.success + c.partial + c.failed;
  return total === 0 ? null : (c.success + c.partial) / total;
}

export type CollectorStatusInput = {
  circuitOpen: boolean;
  integrationStatus: string;
  successRate24h: number | null;
  collectionLagSeconds: number | null;
  maxPollIntervalSeconds: number | null;
};

/** doc 09 §4 (FR-084 circuit): paused > degraded > healthy. Null rate/lag are ignored. */
export function deriveCollectorStatus(i: CollectorStatusInput): CollectorStatus {
  if (i.circuitOpen || i.integrationStatus !== "connected") return "paused";
  if (i.successRate24h !== null && i.successRate24h < SUCCESS_RATE_DEGRADED_BELOW) return "degraded";
  if (
    i.collectionLagSeconds !== null &&
    i.maxPollIntervalSeconds !== null &&
    i.collectionLagSeconds > LAG_POLL_MULTIPLIER * i.maxPollIntervalSeconds
  )
    return "degraded";
  return "healthy";
}

export type AnalysisStatus = "healthy" | "degraded" | "budget_paused";

/** Above this 24h failure rate analysis is `degraded` (doc 09 §4). */
export const ANALYSIS_FAILURE_RATE_DEGRADED_ABOVE = 0.1;
/** Oldest open run older than this is `degraded` (doc 09 §4). */
export const ANALYSIS_LAG_DEGRADED_SECONDS = 1800;

/** FR-176: age of the oldest pending|processing run; 0 when none is open (doc 09 §4). */
export function computeAnalysisLagSeconds(oldestOpenCreatedAt: Date | null, now: Date): number {
  if (!oldestOpenCreatedAt) return 0;
  return Math.max(0, Math.floor((now.getTime() - oldestOpenCreatedAt.getTime()) / 1000));
}

/** failed / (failed + completed) over 24h; empty sample → null. */
export function computeAnalysisFailureRate(c: { failed: number; completed: number }): number | null {
  const total = c.failed + c.completed;
  return total === 0 ? null : c.failed / total;
}

export type AnalysisStatusInput = {
  budgetExceeded: boolean;
  authPaused: boolean;
  failureRate24h: number | null;
  lagSeconds: number;
};

/** doc 09 §4 / doc 07 §9: budget_paused > degraded (auth pause, failure rate, lag) > healthy. */
export function deriveAnalysisStatus(i: AnalysisStatusInput): AnalysisStatus {
  if (i.budgetExceeded) return "budget_paused";
  if (i.authPaused) return "degraded";
  if (i.failureRate24h !== null && i.failureRate24h > ANALYSIS_FAILURE_RATE_DEGRADED_ABOVE) return "degraded";
  if (i.lagSeconds > ANALYSIS_LAG_DEGRADED_SECONDS) return "degraded";
  return "healthy";
}
