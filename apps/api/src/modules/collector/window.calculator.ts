/**
 * Search window calculation for a listening query run.
 *
 * Pure functions (no DI, no clock access) so every edge case is unit-testable —
 * docs/02-architecture/06-ingestion-pipeline.md §4 · FR-072 · BR-011 · BR-012.
 */

const SECOND_MS = 1_000;
const DAY_MS = 86_400_000;

/** Fields of `listening_queries` the window depends on. */
export type WindowQueryState = {
  lastSuccessfulSyncAt: Date | null;
  /** Extra time re-fetched before `lastSuccessfulSyncAt` to catch late-indexed posts (BR-012, default 1200 s). */
  overlapSeconds: number;
  /** Window length of the very first run, in days (BR-011, default 1). */
  initialBackfillDays: number;
};

export type WindowConfig = {
  /** `COLLECTOR_MAX_WINDOW_DAYS` — hard clamp so a long outage cannot request an unbounded window. */
  maxWindowDays: number;
};

/**
 * Why `since` ended up where it is — logged per job and shown in the sync-job detail drawer.
 * `clamped` and `clock_skew` are the abnormal ones worth alerting on.
 */
export type WindowReason = "first_run" | "overlap" | "clamped" | "clock_skew";

export type SyncWindow = { since: Date; until: Date; reason: WindowReason };

/** Default used when a query stores `initialBackfillDays = 0` (BR-011: first run covers at least one day). */
export const DEFAULT_INITIAL_BACKFILL_DAYS = 1;

/**
 * `[since, until]` for the next run of `query` at `now`.
 *
 * - first run (no `lastSuccessfulSyncAt`) → `since = now − initialBackfillDays`
 * - otherwise → `since = lastSuccessfulSyncAt − overlapSeconds` (duplicates inside the overlap are expected, BR-013)
 * - clock skew (`since > until`, e.g. a future `lastSuccessfulSyncAt`) → `since = until − overlapSeconds`
 * - clamp → `since` never older than `now − maxWindowDays`
 */
export function computeWindow(query: WindowQueryState, now: Date, cfg: WindowConfig): SyncWindow {
  const until = new Date(now.getTime());
  const overlapMs = Math.max(0, query.overlapSeconds) * SECOND_MS;

  let reason: WindowReason = "overlap";
  let sinceMs: number;

  if (!query.lastSuccessfulSyncAt) {
    reason = "first_run";
    const days = query.initialBackfillDays > 0 ? query.initialBackfillDays : DEFAULT_INITIAL_BACKFILL_DAYS;
    sinceMs = until.getTime() - days * DAY_MS;
  } else {
    sinceMs = query.lastSuccessfulSyncAt.getTime() - overlapMs;
  }

  if (sinceMs > until.getTime()) {
    reason = "clock_skew";
    sinceMs = until.getTime() - overlapMs;
  }

  const floorMs = until.getTime() - Math.max(0, cfg.maxWindowDays) * DAY_MS;
  if (sinceMs < floorMs) {
    reason = "clamped";
    sinceMs = floorMs;
  }

  return { since: new Date(sinceMs), until, reason };
}

/** Window length in seconds — used for job logging and the `records/window` sanity check in System Status. */
export function windowSeconds(w: SyncWindow): number {
  return Math.round((w.until.getTime() - w.since.getTime()) / SECOND_MS);
}
