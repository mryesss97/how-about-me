import type { ErrorCode } from "@how-about-me/contracts";
import { AppError } from "./app.error";

/**
 * An upstream provider failure already mapped to one of the `THREADS_*` codes
 * (docs/02-architecture/06-ingestion-pipeline.md §2 error mapping, FR-082).
 *
 * Carries what the retry policy needs to decide — the parsed `Retry-After` and the raw upstream
 * status/subcode — so `withRetry` never has to know about HTTP.
 */
export class ProviderError extends AppError {
  readonly retryAfterMs?: number;
  /** HTTP status returned by the provider (not the status we return to our own clients). */
  readonly providerStatus?: number;
  /** Meta error subcode, stored in `sync_jobs.error_message` for diagnosis. */
  readonly subcode?: string;

  constructor(
    code: ErrorCode,
    message?: string,
    opts: { retryAfterMs?: number; providerStatus?: number; subcode?: string; details?: unknown } = {},
  ) {
    super(code, message, opts.details);
    this.name = "ProviderError";
    if (opts.retryAfterMs !== undefined) this.retryAfterMs = opts.retryAfterMs;
    if (opts.providerStatus !== undefined) this.providerStatus = opts.providerStatus;
    if (opts.subcode !== undefined) this.subcode = opts.subcode;
  }
}

/**
 * Parses a `Retry-After` header — delta-seconds (`"3"`) or an HTTP-date — into milliseconds.
 * Returns `undefined` for a missing/unparseable value and clamps negatives (past dates) to 0.
 */
export function parseRetryAfter(header: string | string[] | undefined | null, now: Date = new Date()) {
  const raw = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.max(0, date.getTime() - now.getTime());
}
