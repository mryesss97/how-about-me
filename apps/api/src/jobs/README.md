# jobs

Role bootstrap: scheduler (collector) and analysis worker are registered only when `APP_ROLE ∈ {worker, all}` (docs/02-architecture/02-backend-design.md §6). Implemented in T-048 / T-070.

## Collector scheduler (T-048)

- `scheduler.module.ts` — wires `QueryClaimRepository`, `SchedulerService` and the `COLLECTOR_RUNNER` token (bound to `CollectorService`, T-052; if a test overrides it with `null` the tick does not start).
- `scheduler.service.ts` — `collector-tick` interval (`COLLECTOR_TICK_MS`), claim → run with bounded concurrency → `completeRun`; releases locks on shutdown.
- `query-claim.repository.ts` — raw SQL claim (`FOR UPDATE SKIP LOCKED`, stale lock, manual-first), guarded release.
- `next-run.ts` — pure `computeNextRunAt` (success/partial vs failure backoff, cap 3600 s).
- `collector-runner.ts` — `CollectorRunner` / `ClaimedQuery` / `RunOutcome` contract (`ClaimedQuery.workerId` = lock holder). Creating/updating `sync_jobs` (incl. the manual job in `manualJobId`) is the runner's job.

## Analysis worker (T-070)

- `modules/analysis/analysis-worker.service.ts` adds the `analysis-worker` interval via `SchedulerRegistry` only when `APP_ROLE ∈ {worker, all}`, `NODE_ENV ≠ test` and `ANALYSIS_RUN_PROCESSOR` is bound. Tests call `tick()` directly.

## Retention job (T-153)

- `retention-job.module.ts` / `retention-job.service.ts` — `retention-job` cron (`RETENTION_JOB_CRON`, `RETENTION_JOB_TIMEZONE`), registered only when `RETENTION_JOB_MODE ≠ off`, `APP_ROLE ∈ {worker, all}` and `NODE_ENV ≠ test`. Reuses `modules/retention/purge.ts`; logs dry-run counts per scope, deletes only in `apply`. Tests call `run(now)` directly.
- `retention-plan.ts` — pure UTC-midnight cutoffs and scope list (per project `project` + `runs`, then global `sync-jobs`).
- See docs/05-operations/04-data-retention-purge.md.
