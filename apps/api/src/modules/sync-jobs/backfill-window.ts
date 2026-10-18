import { AppError } from "../../common/errors/app.error";

const DAY_MS = 86_400_000;
/** Tolerated clock skew for `until` slightly ahead of the server clock. */
export const BACKFILL_FUTURE_SKEW_MS = 60_000;

/**
 * T-140 / FR-063: backfill window rules (UTC instants). `until > since`, span ≤ `maxDays`
 * (COLLECTOR_MAX_BACKFILL_DAYS) and `until` not in the future → else 400 BACKFILL_WINDOW_INVALID.
 */
export function assertBackfillWindow(since: Date, until: Date, now: Date, maxDays: number): void {
  const details = { since: since.toISOString(), until: until.toISOString(), maxDays };
  if (until.getTime() <= since.getTime())
    throw new AppError("BACKFILL_WINDOW_INVALID", "until must be after since", details);
  if (until.getTime() - since.getTime() > maxDays * DAY_MS)
    throw new AppError("BACKFILL_WINDOW_INVALID", `Backfill window exceeds ${maxDays} days`, details);
  if (until.getTime() > now.getTime() + BACKFILL_FUTURE_SKEW_MS)
    throw new AppError("BACKFILL_WINDOW_INVALID", "until must not be in the future", details);
}
