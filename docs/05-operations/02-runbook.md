# 02 · Operations Runbook

| Field    | Value                                |
| -------- | ------------------------------------ |
| Status   | Draft → finalised in M5              |
| Audience | Tech Lead / on-call engineer / Admin |

## 0. Quick links

System Status `/system-status` · Health `GET /health/ready` · Logs (host) · Supabase dashboard · Alerts channel.

## 1. Threads connection expired / permission error

**Signal:** System Status Threads = `expired`/`permission_error`; alert "Integration expired"; jobs failing with `THREADS_UNAUTHORIZED/FORBIDDEN`.

1. Confirm in Settings → Integrations (admin).
2. Obtain a new long-lived token (Meta flow documented in POC report) — Admin pastes it in "Update token", then "Verify".
3. Scheduler resumes automatically on `connected`. Check next sync within 2 min in Sync jobs.
4. Gap recovery: if outage > overlap, run **Backfill** (P1 UI) or `POST …/listening-queries/:id/backfill` for the outage window.
5. If `permission_error` persists: check Meta app status/App Review; escalate to owner.

## 2. Sync failing / collector paused

**Signal:** collector `degraded`/`paused`; lag alert.

- Open the failed job → error code:
  - `THREADS_RATE_LIMITED`: expected occasionally; if persistent, increase poll interval for noisy queries; check `provider_usage`.
  - `THREADS_UPSTREAM_ERROR/TIMEOUT`: Meta side; circuit opens after 5; wait; verify with "Verify connection".
  - `THREADS_MALFORMED_RESPONSE`: capture sample from logs (redacted); open bug; possibly API change → fix adapter.
- Circuit open: resolves after `COLLECTOR_CIRCUIT_OPEN_SECONDS`; to force, run "Verify connection" (success closes circuit) or restart worker.
- Retry a job: System Status → Sync jobs → Retry (resumes from `last_cursor`).

## 3. Analysis backlog / failures

**Signal:** pending > 500, failed 24 h high, `analysis.status=degraded|budget_paused`.

- `budget_paused`: raise `ANALYSIS_DAILY_BUDGET_USD` (env) or wait until UTC midnight; confirm cost drivers (volume spike? relevance gate off?).
- Provider auth: rotate `OPENAI_API_KEY`; restart.
- `ANALYSIS_SCHEMA_INVALID` spike: model drift → inspect sample in run `error_message`; adjust prompt → bump `classifier-vN`; retry failed (`POST …/analysis-runs/retry-failed`).
- Stuck `processing`: watchdog re-queues after 10 min; if not, check worker liveness.

## 4. Manual run / backfill

- Run now: Listening Queries → ⋯ → Run now (admin). Only one non-terminal job per query.
- Backfill: `POST /api/v1/projects/:pid/listening-queries/:id/backfill {since, until}`; watch job in Sync jobs; verify no duplicates (counters show `duplicated`).

## 5. Re-analysis after prompt/model change

1. Deploy with new `prompt_version`/model.
2. Optionally mark old version stale & bulk enqueue (P1 endpoint) within `ANALYSIS_BULK_MAX`; otherwise new posts only.
3. Watch cost and failure rate; compare eval report before/after.

## 6. Token/secret rotation

- Threads token: §1. OpenAI key: env + restart. Encryption key: add new key to `INTEGRATION_ENCRYPTION_KEYS`, set active, deploy, run `pnpm --filter api secrets:rewrap`, remove old key next release.

## 7. Purge data

`pnpm --filter api purge -- --project <id> --before 2025-09-01` (dry-run default; `--apply` to execute). Audited. See [04-data-retention-purge.md](04-data-retention-purge.md).

## 8. Deploy / rollback

Deploy via CI on `main` tag. Rollback: redeploy previous tag (host UI) — migrations are additive; if a migration must be reverted, restore from backup to staging first and follow the migration's documented down-path.

## 9. Health & restart

`GET /health/ready` 503 → DB unreachable: check Supabase status, pooler limits (`connection_limit`), restart API. Worker restart is safe (locks expire in 15 min; claims are idempotent).

## 10. Incident notes

Record in `docs/05-operations/incidents/YYYY-MM-DD-<slug>.md`: timeline, impact (lag, missing window), root cause, actions, backfill performed.
