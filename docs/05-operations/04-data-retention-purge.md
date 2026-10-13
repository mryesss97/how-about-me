# 04 · Data Retention & Purge

| Field  | Value                                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved defaults; legal/terms verification before production                                                                                                                            |
| Source | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §21–§22 · [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §3 |

## 1. Retention defaults (configurable via env `RETENTION_*_DAYS`)

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
```

- Exactly one scope. Dry run is the default; `--apply` deletes. Options: `--batch-size N` (default 1 000, max 5 000), `--platform` (default `threads`), `--actor <user_profiles uuid>` (written to `actor_user_id`, otherwise null).
- `--before YYYY-MM-DD` is required for `--project` and `--sync-jobs`; it is read as `00:00:00Z` UTC and is exclusive (`published_at < before` for posts, `created_at < before` for sync jobs). No implicit default from `RETENTION_*_DAYS` (applying defaults is the scheduled job's job). To wipe a whole project, pass a future date explicitly.
- Sync jobs in `queued` / `running` are never purged.
- Delete order per batch (explicit so per-table counts are exact; FKs would cascade anyway): matches → overrides → intents/topics → analyses → runs → post. Overrides go before analyses so their `analysis_id SET NULL` never fires.
- Each batch runs in one transaction together with one `audit_logs` row: `action='data.purged'`, `entity_type` `social_post` | `sync_job`, `entity_id` = post id for `--post`, `project_id` (null for global sync-jobs purge), `metadata={scope, count, counts:{…per table}, before?, platformPostId?}`. All batches of one run share a `request_id`. Audit failure rolls the batch back. Dry run and runs that delete nothing write no audit; re-running is idempotent.
- Output lists ids/counts only — never post text or usernames. `audit_logs` and `analytics_daily` are never purged; historical daily aggregates stay unchanged unless a day is re-aggregated.
- Purging non-current `analysis_runs` by `RETENTION_RUNS_DAYS` is not covered by the CLI (follow-up with T-153).
- Scheduled retention job (P1, T-153): weekly `@Cron` applying the defaults with dry-run log first.

## 3. Compliance notes

- Public UGC via official API; keep permalink for traceability; no media binaries; no enrichment.
- Verify Meta Platform Terms regarding storage duration and deletion obligations before production; document outcome here.
- Deletion requests (post removed on Threads / user request): purge single post; analytics recompute naturally.
- Backups retain purged data until backup expiry (Supabase Pro 7 days) — document in privacy notes.
