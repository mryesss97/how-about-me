import { AppError } from "../errors/app.error";
import {
  computeDelayMs,
  DEFAULT_RETRY_POLICY,
  exceedsRetryAfterBudget,
  isRetryable,
  type RetryPolicy,
} from "./retry.policy";

export type RetryAttemptInfo = {
  /** 1 = the first retry (i.e. the first attempt has already failed). */
  attempt: number;
  delayMs: number;
  error: unknown;
  /** Set when the failure was already mapped to one of our codes. */
  code?: string;
  /** True when the delay came from a provider `Retry-After` header rather than from backoff. */
  fromRetryAfter: boolean;
};

export type WithRetryOptions = Partial<RetryPolicy> & {
  /** Called before each wait — the collector uses it for `rate_limit_events++` and per-job logging (FR-083). */
  onRetry?: (info: RetryAttemptInfo) => void;
  /** Called once when the error is not retryable, before it is rethrown (TC-COL-019). */
  onGiveUp?: (info: {
    attempts: number;
    error: unknown;
    reason: "not_retryable" | "exhausted" | "retry_after_too_long";
  }) => void;
};

/**
 * Runs `fn`, retrying transient provider failures per the policy — docs/02-architecture/06-ingestion-pipeline.md §7.
 *
 * The original error is always rethrown (never wrapped) so the caller still sees the mapped
 * `THREADS_*` code it needs for `sync_jobs.error_code`.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: WithRetryOptions = {}): Promise<T> {
  const { onRetry, onGiveUp, ...overrides } = options;
  const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...overrides };

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      const retriesUsed = attempt - 1;
      const reason = !isRetryable(error)
        ? "not_retryable"
        : exceedsRetryAfterBudget(error, policy)
          ? "retry_after_too_long"
          : retriesUsed >= policy.maxRetries
            ? "exhausted"
            : undefined;

      if (reason) {
        onGiveUp?.({ attempts: attempt, error, reason });
        throw error;
      }

      const delayMs = computeDelayMs(attempt, error, policy);
      onRetry?.({
        attempt,
        delayMs,
        error,
        ...(error instanceof AppError ? { code: error.code } : {}),
        fromRetryAfter: hasRetryAfter(error),
      });
      await policy.sleep(delayMs);
    }
  }
}

function hasRetryAfter(error: unknown): boolean {
  return typeof (error as { retryAfterMs?: number } | null)?.retryAfterMs === "number";
}
