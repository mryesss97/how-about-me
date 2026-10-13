# mentions module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `mentions`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Implemented

- `POST /api/v1/projects/:projectId/mentions/:mentionId/reanalyze` (T-076, FR-115) — admin; analyst when `allowAnalystReanalyze`. 202 `{ runId, status: "pending" }`, 409 `ANALYSIS_ALREADY_PENDING` when the post has any `pending|processing` run, audit `analysis.reanalyze_requested`.
- `GET /api/v1/projects/:projectId/mentions` (T-095, FR-150/152/153/161) — all roles. Base set from `analytics-filters.buildBaseSetCte` (drill-down equivalence); sort specs + keyset predicate + search in `mentions-query.ts` (5 sorts, `post_id` tie-breaker, NOT NULL sentinels); cursor `encodeSortCursor` bound to the sort (keys as SQL text for µs precision); `q` → FTS `websearch_to_tsquery('simple')`, ILIKE for < 3 chars or no letters/digits; `count=true` exact COUNT under `statement_timeout` 1500 ms (omitted on timeout). Projection in `mentions.mapper.ts`; matches/intents/topics/error codes hydrated in 4 batch queries.
