# mentions module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `mentions`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Implemented

- `POST /api/v1/projects/:projectId/mentions/:mentionId/reanalyze` (T-076, FR-115) — admin; analyst when `allowAnalystReanalyze`. 202 `{ runId, status: "pending" }`, 409 `ANALYSIS_ALREADY_PENDING` when the post has any `pending|processing` run, audit `analysis.reanalyze_requested`.
