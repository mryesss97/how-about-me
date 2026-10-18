# sync-jobs module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `sync-jobs`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Contents

- `sync-job.recorder.ts` — `SyncJobRecorder` (T-052): `start` (take over a queued manual/retry job or create a `scheduled` one), `recordPageTx` (counters + `last_cursor` + `provider_usage` inside the page transaction), `recordFailedAttempts`, `finish`. Used by `CollectorService`.
- `sync-jobs.controller.ts` / `sync-jobs.service.ts` / `sync-jobs.repository.ts` (T-055): `GET …/sync-jobs` (keyset list, filters), `GET …/sync-jobs/:jobId` (detail + `providerUsage` without raw headers), `POST …/sync-jobs/:jobId/retry` (admin; new queued `retry` job copying `last_cursor` + `window_*`, query row locked, audited `sync_job.retry_requested`).
