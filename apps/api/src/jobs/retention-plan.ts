import type { PurgeScope } from "../modules/retention/purge";

const DAY_MS = 86_400_000;

/**
 * Retention cutoff (T-153, NFR-054): `now − days`, truncated to 00:00:00Z. Exclusive bound — same semantics as
 * the purge CLI `--before`. The cron timezone only drives the schedule, never the cutoff.
 */
export function retentionCutoff(now: Date, days: number): Date {
  const d = new Date(now.getTime() - days * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type RetentionDays = {
  RETENTION_POSTS_DAYS: number;
  RETENTION_RUNS_DAYS: number;
  RETENTION_SYNC_JOBS_DAYS: number;
};

/** Order: per project posts (`project`) then history (`runs`); one global `sync-jobs` scope last. */
export function buildRetentionScopes(projectIds: readonly string[], cfg: RetentionDays, now: Date): PurgeScope[] {
  const posts = retentionCutoff(now, cfg.RETENTION_POSTS_DAYS);
  const runs = retentionCutoff(now, cfg.RETENTION_RUNS_DAYS);
  const scopes: PurgeScope[] = [];
  for (const projectId of projectIds) {
    scopes.push({ scope: "project", projectId, before: posts });
    scopes.push({ scope: "runs", projectId, before: runs });
  }
  scopes.push({ scope: "sync-jobs", before: retentionCutoff(now, cfg.RETENTION_SYNC_JOBS_DAYS) });
  return scopes;
}
