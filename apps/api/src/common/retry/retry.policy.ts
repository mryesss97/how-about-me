import type { ErrorCode } from "@how-about-me/contracts";
import { AppError } from "../errors/app.error";
import { ProviderError } from "../errors/provider.error";

/**
 * Retry rules for provider calls — docs/02-architecture/06-ingestion-pipeline.md §7 (FR-083).
 *
 * | Failure                 | Behaviour                                                                    |
 * | ----------------------- | ---------------------------------------------------------------------------- |
 * | 429                     | wait `Retry-After` when present, else backoff; retry ≤ `maxRetries`          |
 * | 5xx / timeout / network | exponential backoff `base × 2^(attempt−1)`, capped, full jitter; ≤ maxRetries |
 * | 401 / 403 / 400         | no retry — the job fails and the integration status is updated (FR-085)      |
 * | malformed response      | no retry — retrying a broken payload just burns quota                        |
 */
export type RetryPolicy = {
  /** `COLLECTOR_MAX_RETRIES` — retries *after* the first attempt (3 ⇒ at most 4 calls). */
  maxRetries: number;
  /** Base of the exponential backoff, doc default 2 s. */
  baseDelayMs: number;
  /** Ceiling of the exponential backoff, doc default 60 s. */
  maxDelayMs: number;
  /** Upper bound we are willing to honour from `Retry-After`; beyond it we stop retrying. */
  maxRetryAfterMs: number;
  /** Injected in tests; `Math.random` in production (full jitter). */
  random: () => number;
  /** Injected in tests so no suite ever really sleeps. */
  sleep: (ms: number) => Promise<void>;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 2_000,
  maxDelayMs: 60_000,
  maxRetryAfterMs: 300_000,
  random: Math.random,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Transient upstream conditions: another attempt can plausibly succeed. */
export const RETRYABLE_ERROR_CODES: readonly ErrorCode[] = [
  "THREADS_RATE_LIMITED",
  "THREADS_UPSTREAM_ERROR",
  "THREADS_TIMEOUT",
];

/** Deterministic failures: retrying cannot help and only wastes provider quota. */
export const NON_RETRYABLE_ERROR_CODES: readonly ErrorCode[] = [
  "THREADS_UNAUTHORIZED",
  "THREADS_FORBIDDEN",
  "THREADS_MALFORMED_RESPONSE",
  "VALIDATION_ERROR",
];

export function retryPolicyFromConfig(cfg: { COLLECTOR_MAX_RETRIES: number }, over: Partial<RetryPolicy> = {}) {
  return { ...DEFAULT_RETRY_POLICY, maxRetries: cfg.COLLECTOR_MAX_RETRIES, ...over };
}

/**
 * Anything not mapped to an `AppError` yet (raw `fetch` failure, `AbortError`, DNS error) is treated as a
 * transient network problem — the provider adapter maps what it can recognise, this is the safety net.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) return RETRYABLE_ERROR_CODES.includes(error.code);
  return error instanceof Error;
}

/**
 * Delay before retry number `attempt` (1 = first retry).
 * `Retry-After` wins when the provider sent one (TC-COL-018) and is used verbatim — no jitter — so the
 * wait is never shorter than what the provider asked for.
 */
export function computeDelayMs(attempt: number, error: unknown, policy: RetryPolicy): number {
  const retryAfter = error instanceof ProviderError ? error.retryAfterMs : undefined;
  if (retryAfter !== undefined) return retryAfter;
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(policy.random() * ceiling); // full jitter — spreads a thundering herd of workers
}

/** A `Retry-After` longer than we are willing to wait ends the attempt loop instead of blocking a worker. */
export function exceedsRetryAfterBudget(error: unknown, policy: RetryPolicy): boolean {
  const retryAfter = error instanceof ProviderError ? error.retryAfterMs : undefined;
  return retryAfter !== undefined && retryAfter > policy.maxRetryAfterMs;
}
