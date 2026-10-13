# collector module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `collector`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Contents

- `post-normalizer.ts` — provider item → `NormalizedPost` (T-050).
- `ingestion.service.ts` — `IngestionService.ingestPage(query, posts)`: upsert posts/matches, change detection, `excluded_by_terms`, enqueue analysis; returns `{ inserted, updated, duplicated, excluded, enqueued }` (T-051, doc 06 §6).
- Enqueue uses the `AnalysisEnqueuer` port (`../analysis/analysis-enqueuer.ts`, token `ANALYSIS_ENQUEUER`); T-070 swaps in `AnalysisService`.
