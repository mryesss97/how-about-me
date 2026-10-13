# jobs

Role bootstrap: scheduler (collector) and analysis worker are registered only when `APP_ROLE ∈ {worker, all}` (docs/02-architecture/02-backend-design.md §6). Implemented in T-048 / T-070.

## Collector scheduler (T-048)

- `scheduler.module.ts` — wires `QueryClaimRepository`, `SchedulerService` and the `COLLECTOR_RUNNER` token (bound to `null` until T-052 rebinds it to `CollectorService`; with no runner the tick does not start, so nothing is claimed and no schedule state moves).
- `scheduler.service.ts` — `collector-tick` interval (`COLLECTOR_TICK_MS`), claim → run with bounded concurrency → `completeRun`; releases locks on shutdown.
- `query-claim.repository.ts` — raw SQL claim (`FOR UPDATE SKIP LOCKED`, stale lock, manual-first), guarded release.
- `next-run.ts` — pure `computeNextRunAt` (success/partial vs failure backoff, cap 3600 s).
- `collector-runner.ts` — `CollectorRunner` / `ClaimedQuery` / `RunOutcome` contract for T-052. Creating/updating `sync_jobs` (incl. the manual job in `manualJobId`) is the runner's job.
