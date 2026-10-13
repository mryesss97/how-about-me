# 04 · Data Retention & Purge

| Field  | Value                                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved defaults; legal/terms verification before production                                                                                                                            |
| Source | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §21–§22 · [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §3 |

## 1. Retention defaults (configurable via env `RETENTION_*_DAYS`, each ≥ 1)

| Data                                             | Default                               | Env                        |
| ------------------------------------------------ | ------------------------------------- | -------------------------- |
| `social_posts` + `post_query_matches` + analyses | 365 days from `published_at`          | `RETENTION_POSTS_DAYS`     |
| `analysis_runs` history (non-current)            | 365 days                              | `RETENTION_RUNS_DAYS`      |
| `sync_jobs`                                      | 180 days                              | `RETENTION_SYNC_JOBS_DAYS` |
| Application logs (host)                          | 30–90 days                            | host setting               |
| `audit_logs`                                     | ≥ 365 days (never auto-purged in MVP) | —                          |
| `analytics_daily`                                | indefinite                            | —                          |

## 2. Purge tooling (`apps/api/src/cli/purge.ts`)

Core logic: `apps/api/src/modules/retention/purge.ts` (`countPurge`, `applyPurge` — reused by the scheduled job T-153). The CLI only parses arguments and prints counts.

```bash
pnpm --filter @how-about-me/api purge -- --project <uuid> --before 2025-09-01            # dry run: counts only
pnpm --filter @how-about-me/api purge -- --project <uuid> --before 2025-09-01 --apply    # batches of 1 000
pnpm --filter @how-about-me/api purge -- --post <platform_post_id> --apply               # single post (takedown)
pnpm --filter @how-about-me/api purge -- --sync-jobs --before 2026-03-01 [--project <uuid>] --apply
pnpm --filter @how-about-me/api purge -- --runs --before 2025-10-01 [--project <uuid>] --apply   # non-current analysis history
```

- Exactly one scope. Dry run is the default; `--apply` deletes. Options: `--batch-size N` (default 1 000, max 5 000), `--platform` (default `threads`), `--actor <user_profiles uuid>` (written to `actor_user_id`, otherwise null).
- `--before YYYY-MM-DD` is required for `--project`, `--sync-jobs` and `--runs`; it is read as `00:00:00Z` UTC and is exclusive (`published_at < before` for posts, `created_at < before` for sync jobs). No implicit default from `RETENTION_*_DAYS` (applying defaults is the scheduled job's job). To wipe a whole project, pass a future date explicitly.
- Sync jobs in `queued` / `running` are never purged.
- Delete order per batch (explicit so per-table counts are exact; FKs would cascade anyway): matches → overrides → intents/topics → analyses → runs → post. Overrides go before analyses so their `analysis_id SET NULL` never fires.
- Each batch runs in one transaction together with one `audit_logs` row: `action='data.purged'`, `entity_type` `social_post` | `sync_job` | `analysis_run`, `entity_id` = post id for `--post`, `project_id` (null for global sync-jobs purge), `metadata={scope, count, counts:{…per table}, before?, platformPostId?}`. All batches of one run share a `request_id`. Audit failure rolls the batch back. Dry run, runs that delete nothing and batches whose rows were already removed concurrently write no audit; re-running is idempotent.
- Output lists ids/counts only — never post text or usernames. `audit_logs` and `analytics_daily` are never purged; historical daily aggregates stay unchanged unless a day is re-aggregated.
- `--runs` (T-153) purges analysis history. A run is deleted only when all hold: (a) `created_at < before`; (b) `status` not `pending`/`processing`; (c) its `post_analyses` row (if any) is neither a post's `current_analysis_id` nor referenced by any `analysis_overrides.analysis_id`; (d) the post has a newer run by `(created_at, id)` — the latest run per post is always kept. Delete order per batch: intents → topics → analyses → runs; eligibility is re-checked inside the transaction. Audit `entity_type='analysis_run'`, `metadata={scope:"runs", count, counts:{runs, analyses, intents, topics}, before}`. Posts and overrides are never touched.

### Scheduled retention job (T-153)

`apps/api/src/jobs/retention-job.service.ts` applies the §1 defaults on a cron.

| Env                      | Default            | Meaning                                                                          |
| ------------------------ | ------------------ | -------------------------------------------------------------------------------- |
| `RETENTION_JOB_MODE`     | `off`              | `off` (not scheduled) · `dry-run` (log counts only) · `apply` (log, then delete) |
| `RETENTION_JOB_CRON`     | `0 3 * * 0`        | Schedule (Sunday 03:00); invalid expressions fail env validation at boot         |
| `RETENTION_JOB_TIMEZONE` | `Asia/Ho_Chi_Minh` | Timezone of the schedule only                                                    |

- Registered only when mode ≠ `off`, `APP_ROLE ∈ {worker, all}` and `NODE_ENV ≠ test`. Enabling: set `dry-run`, review at least one run's logs, then switch to `apply`. The job never changes mode itself.
- Cutoffs: `now − RETENTION_*_DAYS`, truncated to `00:00:00Z` UTC, exclusive (same as `--before`).
- Scopes run one at a time: for each project `project` (posts, `RETENTION_POSTS_DAYS`) then `runs` (`RETENTION_RUNS_DAYS`), then one global `sync-jobs` (`RETENTION_SYNC_JOBS_DAYS`). Every scope logs `retention dry-run` with counts first; in `apply` mode non-zero scopes are then deleted (`retention applied`). A failing scope is logged and the next one still runs; a summary `retention job done` closes the run. Logs carry ids/dates/counts only.
- Audit: `data.purged` rows as above, `actor_user_id = null`, one `request_id` for the whole run.
- No cross-instance lock (session advisory locks are unreliable through the Prisma/pgbouncer pool). Within one process an overlapping run is skipped; MVP runs one worker, and a duplicate run is harmless because purge is idempotent and empty batches write no audit.

## 3. Compliance notes

- Public UGC via official API; keep permalink for traceability; no media binaries; no enrichment.
- Verify Meta Platform Terms regarding storage duration and deletion obligations before production; document outcome here.
- Deletion requests (post removed on Threads / user request): purge single post; analytics recompute naturally.
- Backups retain purged data until backup expiry (Supabase Pro 7 days) — document in privacy notes.
