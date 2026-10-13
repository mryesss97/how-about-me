import type { RetryPolicy } from "../../../common/retry";

/**
 * In-adapter retry policy shared by the OpenAI adapters (T-071 moderation, T-072 classifier) — doc 07 §8:
 * base 2 s, cap 30 s; a Retry-After above 60 s is left to the job-level backoff (T-075).
 */
export const ADAPTER_RETRY: Partial<RetryPolicy> = { baseDelayMs: 2_000, maxDelayMs: 30_000, maxRetryAfterMs: 60_000 };
