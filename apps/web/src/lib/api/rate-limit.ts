import { z } from "zod";
import { ApiError } from "./client";

const RetryAfterDetailsSchema = z.object({ retryAfterSeconds: z.number().nonnegative() });

/** Seconds to wait from a `429 RATE_LIMITED` error (`details.retryAfterSeconds`), else null. */
export function retryAfterSeconds(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.code !== "RATE_LIMITED") return null;
  const parsed = RetryAfterDetailsSchema.safeParse(err.details);
  return parsed.success ? parsed.data.retryAfterSeconds : null;
}

/** Human wait time for a rate-limit message ("45 seconds", "1 minute", "5 minutes", "later"). */
export function waitText(seconds: number | null): string {
  if (seconds === null) return "later";
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} seconds`;
  const m = Math.ceil(seconds / 60);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

/** Vietnamese wait time for rate-limit messages on restyled screens (#277): "45 giây", "5 phút", "ít phút nữa". */
export function waitTextVi(seconds: number | null): string {
  if (seconds === null) return "ít phút nữa";
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} giây`;
  return `${Math.ceil(seconds / 60)} phút`;
}
