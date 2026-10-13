import type { RunStatus } from "./collector-runner";

/**
 * Schedule-level backoff for listening queries — docs/02-architecture/06-ingestion-pipeline.md §3, FR-071, FR-083.
 * Distinct from `common/retry` (per-request backoff with jitter inside a single run): this one is
 * deterministic and decides when the whole query is attempted again.
 */
export const MAX_FAILURE_BACKOFF_SECONDS = 3_600;
/** Exponent cap so 2^n never overflows; 2^20 × any sane interval already exceeds the 3600 s cap. */
const MAX_BACKOFF_EXPONENT = 20;

export type NextRunInput = {
  status: RunStatus;
  /** When the run finished (from the runner). */
  completedAt: Date;
  /** Current clock, used as the base for failure backoff. */
  now: Date;
  pollIntervalSeconds: number;
  /** Failures *before* this run (n in `interval × 2^n`). */
  consecutiveFailures: number;
};

export type NextRunResult = { nextRunAt: Date; consecutiveFailures: number };

export function computeNextRunAt(input: NextRunInput): NextRunResult {
  const { status, completedAt, now, pollIntervalSeconds, consecutiveFailures } = input;
  if (status === "success" || status === "partial") {
    // partial counts as success for scheduling; failures reset.
    return { nextRunAt: new Date(completedAt.getTime() + pollIntervalSeconds * 1_000), consecutiveFailures: 0 };
  }
  const n = Math.min(Math.max(consecutiveFailures, 0), MAX_BACKOFF_EXPONENT);
  const delaySeconds = Math.min(pollIntervalSeconds * 2 ** n, MAX_FAILURE_BACKOFF_SECONDS);
  return { nextRunAt: new Date(now.getTime() + delaySeconds * 1_000), consecutiveFailures: consecutiveFailures + 1 };
}
