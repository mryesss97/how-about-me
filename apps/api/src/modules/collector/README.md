# collector module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `collector`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Contents

- `post-normalizer.ts` — provider item → `NormalizedPost` (T-050).
- `ingestion.service.ts` — `IngestionService.ingestPage(query, posts)`: upsert posts/matches, change detection, `excluded_by_terms`, enqueue analysis; returns `{ inserted, updated, duplicated, excluded, enqueued }` (T-051, doc 06 §6).
- Enqueue uses the `AnalysisEnqueuer` port (`../analysis/analysis-enqueuer.ts`, token `ANALYSIS_ENQUEUER`); implemented by `AnalysisService` from `AnalysisModule` (T-070).
- `ingestPage(query, posts, afterPage?)` — `afterPage(tx, result)` runs in the page transaction; the collector writes `sync_jobs` counters there (T-052).
- `collector.service.ts` — `CollectorService` (`CollectorRunner`, T-052): `sync_jobs` lifecycle, window, page loop with `withRetry`, page cap, RECENT early stop, `success|partial|failed`, `last_successful_sync_at` only on success (BR-014) and never for a `backfill` job; search type comes from the job (BR-008, T-140). Doc 06 §5.
- `circuit-breaker.service.ts` + `collector-state.repository.ts` — per-project circuit breaker in `collector_state` (T-054, FR-084, doc 06 §7): `recordOutcome` (failed → atomic increment, open at threshold; success → close; partial → no change), `tryAcquireProbe` (single half-open probe), `getState` (closed/open/half_open, used by System Status T-057).
