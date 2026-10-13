# analysis module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `analysis`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Providers

- `providers/fake-safety.provider.ts`, `providers/fake-classifier.provider.ts` — offline fakes (`PROVIDERS_MODE=fake`, T-013).
- `providers/openai-moderation.provider.ts` — real `SafetyProvider` over OpenAI `/v1/moderations` (T-071), HTTP via `providers/openai-http.ts`.
- `safety/safety-mapping.ts` — `toSafetyAnalysis()` maps a provider result to the persisted safety fields (BR-017, BR-018).
- Real classifier: T-072.

## Runs (T-070)

- `analysis-state.ts` — state machine (`ANALYSIS_TRANSITIONS`, FR-100).
- `analysis.service.ts` — `AnalysisService`: enqueue with version dedupe (implements the `ANALYSIS_ENQUEUER` port, BR-023/BR-024/FR-116), `claimBatch` (`FOR UPDATE SKIP LOCKED`, FR-101), guarded transitions `markCompleted` / `markSkipped` / `markFailed` / `requeue`, watchdog `requeueStuck`.
- `analysis-worker.service.ts` — poll loop; see `../../jobs/README.md`.
- `run-processor.ts` — `ANALYSIS_RUN_PROCESSOR` port; real pipeline in T-074.
