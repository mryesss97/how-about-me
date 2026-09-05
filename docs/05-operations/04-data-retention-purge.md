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

```bash
pnpm --filter api purge -- --project <id> --before 2025-09-01            # dry run: counts only
pnpm --filter api purge -- --project <id> --before 2025-09-01 --apply    # executes in batches of 1 000
pnpm --filter api purge -- --post <platform_post_id> --apply             # single post (takedown request)
pnpm --filter api purge -- --sync-jobs --before 2026-03-01 --apply
```

- Deletes cascade: matches → intents/topics → analyses → runs → overrides → post.
- Each apply writes `audit_logs(action='data.purged', metadata={scope, count, before})`.
- Scheduled retention job (P1): weekly `@Cron` applying the defaults with dry-run log first.

## 3. Compliance notes

- Public UGC via official API; keep permalink for traceability; no media binaries; no enrichment.
- Verify Meta Platform Terms regarding storage duration and deletion obligations before production; document outcome here.
- Deletion requests (post removed on Threads / user request): purge single post; analytics recompute naturally.
- Backups retain purged data until backup expiry (Supabase Pro 7 days) — document in privacy notes.
