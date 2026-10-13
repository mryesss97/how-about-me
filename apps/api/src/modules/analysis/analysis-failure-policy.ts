import type { ErrorCode } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import { ProviderError } from "../../common/errors/provider.error";

/**
 * Analysis failure policy (T-075) — docs/02-architecture/07-analysis-pipeline.md §8 (FR-113).
 * Pure functions: classify a processor error into retry / fail / fail-and-pause and compute the job-level backoff.
 */
export const ANALYSIS_AUTH_PAUSE_MS = 5 * 60_000;
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_CAP_MS = 30_000;
export const ERROR_MESSAGE_MAX = 500;

export type FailureAction = "retry" | "fail" | "fail_and_pause";
export type FailureDecision = { action: FailureAction; code: ErrorCode; message: string };

/**
 * The run is no longer held by this worker (watchdog or another worker took it). The worker only logs:
 * no backoff, no requeue/markFailed.
 */
export class AnalysisLockLostError extends Error {
  constructor(readonly runId: string) {
    super("analysis run no longer held by this worker");
    this.name = "AnalysisLockLostError";
  }
}

export function truncateMessage(message: string, max = ERROR_MESSAGE_MAX): string {
  return message.length <= max ? message : `${message.slice(0, max - 1)}…`;
}

/** FR-113 / doc 07 §8 decision table. Unknown errors never expose their message (it may contain data). */
export function decideFailure(error: unknown): FailureDecision {
  if (error instanceof ProviderError) {
    const message = truncateMessage(error.message);
    switch (error.code) {
      case "ANALYSIS_PROVIDER_ERROR":
        return { action: "retry", code: error.code, message };
      case "ANALYSIS_PROVIDER_AUTH":
        return { action: "fail_and_pause", code: error.code, message };
      case "ANALYSIS_SCHEMA_INVALID":
      case "ANALYSIS_PROVIDER_BAD_REQUEST":
        return { action: "fail", code: error.code, message };
      default:
        return { action: "retry", code: "INTERNAL", message };
    }
  }
  if (error instanceof AppError) return { action: "retry", code: "INTERNAL", message: truncateMessage(error.message) };
  return { action: "retry", code: "INTERNAL", message: "unexpected_processor_error" };
}

/** `min(30 s, max(2 s × 2^attempt, Retry-After))` — doc 07 §8, no jitter. */
export function backoffMs(attempt: number, error: unknown): number {
  const retryAfter = error instanceof ProviderError ? (error.retryAfterMs ?? 0) : 0;
  return Math.min(BACKOFF_CAP_MS, Math.max(BACKOFF_BASE_MS * 2 ** attempt, retryAfter));
}
