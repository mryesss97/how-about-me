# 02 · Operations Runbook

| Field          | Value                                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| Status         | Draft → finalised in M5                                                          |
| Audience       | Tech Lead / on-call engineer / Admin                                             |
| Last validated | local 2026-10-18; staging pending — see [§11 Validation log](#11-validation-log) |

## 0. Quick links

System Status `<WEB_URL>/system-status` · Health `GET <API_URL>/health/ready` (and `/health/live`; not under `/api/v1`) · Logs (host) · Supabase dashboard · Alerts channel (placeholder until T-122 / #102 lands).

**Command conventions.** All API paths below are under `<API_URL>/api/v1`. Never paste a real token into docs, tickets or incident notes.

```sh
export API="<API_URL>/api/v1"; export PID="<project-uuid>"
export TOKEN="<admin session JWT>"   # from your own browser session; never commit
AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
```

Mutating routes below require role `admin` unless stated (FR-015); others return `403`.

## 1. Threads connection expired / permission error

**Signal:** System Status Threads = `expired`/`permission_error`; alert "Integration expired"; jobs failing with `THREADS_UNAUTHORIZED/FORBIDDEN`.

1. Confirm in Settings → Integrations (admin).
2. Obtain a new long-lived token (Meta flow documented in POC report) — Admin pastes it in "Update token", then "Verify".
3. Scheduler resumes automatically on `connected`. Check next sync within 2 min in Sync jobs.
4. Gap recovery: if outage > overlap, run a backfill for the gap window (§4, T-140).
5. If `permission_error` persists: check Meta app status/App Review; escalate to owner.
6. Token refresh (T-040): once the POC confirms Threads refresh and the real adapter implements it, set `THREADS_TOKEN_REFRESH_MODE=on` on the worker (cron `THREADS_TOKEN_REFRESH_CRON`, window `THREADS_TOKEN_REFRESH_WINDOW_DAYS`). Failed refreshes show in Audit log as `integration.refresh_failed` (filter by action); a 401/403 there also moves the integration to `expired`/`permission_error`.

**Commands**

```sh
curl -s "${AUTH[@]}" "$API/projects/$PID/integrations/threads"          # status
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/integrations/threads/verify"   # expect status=connected
```

## 2. Sync failing / collector paused

**Signal:** collector `degraded`/`paused`; lag alert.

- Open the failed job → error code:
  - `THREADS_RATE_LIMITED`: expected occasionally; if persistent, increase poll interval for noisy queries; check `provider_usage`.
  - `THREADS_UPSTREAM_ERROR/TIMEOUT`: Meta side; circuit opens after `COLLECTOR_CIRCUIT_FAILURE_THRESHOLD` (default 5) consecutive failed jobs; wait; verify with "Verify connection".
  - `THREADS_MALFORMED_RESPONSE`: capture sample from logs (redacted); open bug; possibly API change → fix adapter.
- Circuit open: resolves after `COLLECTOR_CIRCUIT_OPEN_SECONDS`; to force, run "Verify connection" (success closes circuit) or restart worker.
- Retry a job: System Status → Sync jobs → Retry (resumes from `last_cursor`).

**Commands**

```sh
curl -s "${AUTH[@]}" "$API/projects/$PID/sync-jobs"                       # list, find failed job id
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/sync-jobs/<jobId>/retry"
```

## 3. Analysis backlog / failures

**Signal:** pending > 500, failed 24 h high, `analysis.status=degraded|budget_paused`.

- `budget_paused`: raise `ANALYSIS_DAILY_BUDGET_USD` (env) or wait until UTC midnight; confirm cost drivers (volume spike? relevance gate off?).
- Provider auth: rotate `OPENAI_API_KEY`; restart. The worker stays paused up to 5 min after the last `ANALYSIS_PROVIDER_AUTH` failure (read from the DB, so a restart does not clear it). Runs already `failed ANALYSIS_PROVIDER_AUTH` need an admin retry (T-077).
- `ANALYSIS_SCHEMA_INVALID` spike: model drift → inspect sample in run `error_message`; adjust prompt → bump `classifier-vN`; retry failed (`POST …/analysis-runs/retry-failed`).
- Stuck `processing`: watchdog re-queues after `ANALYSIS_STUCK_MINUTES` (default 10); if not, check worker liveness.

**Commands**

```sh
curl -s "${AUTH[@]}" "$API/projects/$PID/analysis-runs?status=failed"
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/analysis-runs/retry-failed"
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/analysis-runs/<runId>/retry"
```

## 4. Manual run / backfill

- Run now: Listening Queries → ⋯ → Run now (admin). Only one non-terminal job per query.
- Backfill: `POST /api/v1/projects/:pid/listening-queries/:id/backfill {since, until, searchType?}` (window ≤ `COLLECTOR_MAX_BACKFILL_DAYS`, until not in the future; does not move the query watermark); a `partial` (page cap) backfill is resumed with Retry; watch job in Sync jobs; verify no duplicates (counters show `duplicated`).

**Commands**

```sh
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/listening-queries/<queryId>/run"   # 409 if a job is already non-terminal
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/listening-queries/<queryId>/backfill" -d '{"since":"2026-10-01T00:00:00Z","until":"2026-10-08T00:00:00Z"}'   # T-140
```

## 5. Re-analysis after prompt/model change

1. Deploy with new `prompt_version`/model.
2. Optionally (admin): `POST …/analysis-runs/mark-stale?version=<old>&dryRun=true` to preview, then without `dryRun` — stales old-version runs and enqueues up to `ANALYSIS_BULK_MAX` posts (`trigger=version_change`). For posts beyond the cap, wait 5 minutes (shared throttle, `429` + `Retry-After`) and run `POST …/mentions/reanalyze` with `analysisStatus=[stale]`. Otherwise new posts only.
   - Over the daily budget (`ANALYSIS_DAILY_BUDGET_USD`) the worker only claims `manual` runs, so `bulk`/`version_change` runs wait until the next day.
3. Watch cost and failure rate; compare eval report before/after.

**Commands**

```sh
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/analysis-runs/mark-stale?version=<old>&dryRun=true"   # preview
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/analysis-runs/mark-stale?version=<old>"
curl -s -X POST "${AUTH[@]}" "$API/projects/$PID/mentions/reanalyze" -d '{"analysisStatus":["stale"]}'
```

## 6. Token/secret rotation

- Threads token: §1. OpenAI key: env + restart. Encryption key: add new key to `INTEGRATION_ENCRYPTION_KEYS`, set active, deploy, run `pnpm --filter api secrets:rewrap`, remove old key next release. Schedule rotation outside peak hours on staging first — a wrong active key breaks Threads sync until rolled back.

## 7. Purge data

`pnpm --filter api purge -- --project <id> --before 2025-09-01` (dry-run default; `--apply` to execute — destructive: on staging run `--apply` only against a test project). Audited. See [04-data-retention-purge.md](04-data-retention-purge.md).

## 8. Deploy / rollback

Deploy via CI on `main` tag. Rollback: redeploy previous tag (host UI) — migrations are additive; if a migration must be reverted, restore from backup to staging first and follow the migration's documented down-path.

## 9. Health & restart

`GET /health/ready` 503 → DB unreachable: check Supabase status, pooler limits (`connection_limit`), restart API. Worker restart is safe (locks expire in 15 min; claims are idempotent).

## 10. Incident notes

Copy [incidents/\_template.md](incidents/_template.md) to `incidents/YYYY-MM-DD-<slug>.md` (rules in [incidents/README.md](incidents/README.md)). Required for SEV1/SEV2; optional for SEV3. Timestamps in UTC (local `Asia/Ho_Chi_Minh` alongside).

## 11. Validation log

Each procedure must be executed once on staging before this runbook moves to **Final** (T-124). Screenshots go in `assets/runbook/` (mask tokens/emails).

| Procedure                                  | Local (2026-10-18, fake providers, demo seed #294)                                                                                            | Staging |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| §1 Threads expired / verify                | ✓ covered by `integrations.int-spec.ts` (PUT/verify/DELETE, #34) and the 401/403 transition tests (#36); Kết nối card checked in the UI (#37) | pending |
| §2 Sync job retry                          | ✓ `sync-jobs` int-spec: retry creates a new job from the cursor, `SYNC_JOB_NOT_RETRYABLE`, BR-010 (#51); "Thử lại" in System Status (#55)     | pending |
| §3 Analysis retry-failed                   | ✓ `analysis-runs-ops.int-spec.ts`: single + bulk ≤ 500, audit without ids (#70); "Lỗi phân tích" tab (#93)                                    | pending |
| §4 Run now                                 | ✓ `listening-queries-run.int-spec.ts`: 202 queued, `SYNC_ALREADY_RUNNING`, throttle 429 (#39); "Chạy ngay" in the UI (#43)                    | pending |
| §5 mark-stale dry-run + reanalyze          | ✓ `analysis-runs-ops.int-spec.ts` mark-stale cases (#70)                                                                                      | pending |
| §6 secrets:rewrap                          | ✓ `pnpm --filter api secrets:rewrap --dry-run` → active key `k1`, 0 to rewrap (demo secret already on the active key)                         | pending |
| §7 purge dry-run (+ apply on test project) | ✓ `pnpm --filter api purge -- --project <demo> --before 2025-09-01` → counts all 0, "DRY RUN — nothing deleted"; `--apply` not run locally    | pending |
| §8 rollback to previous tag                | — needs the hosting choice (IN-4, #5)                                                                                                         | pending |
| §9 health/ready + worker restart           | ✓ `GET /health/ready` 200, `GET /health/live` 200; API/worker restarted several times on 2026-10-18, scheduler resumed on the next tick       | pending |
