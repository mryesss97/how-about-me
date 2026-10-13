# analysis module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `analysis`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Providers

- `providers/fake-safety.provider.ts`, `providers/fake-classifier.provider.ts` — offline fakes (`PROVIDERS_MODE=fake`, T-013).
- `providers/openai-moderation.provider.ts` — real `SafetyProvider` over OpenAI `/v1/moderations` (T-071), HTTP via `providers/openai-http.ts`.
- `safety/safety-mapping.ts` — `toSafetyAnalysis()` maps a provider result to the persisted safety fields (BR-017, BR-018).
- `providers/openai-structured.classifier.ts` — real `ContentClassifier` over OpenAI `/chat/completions` with strict JSON-schema outputs (T-072); fixtures in `providers/__fixtures__/openai-classifier/` (hand-written until T-081).
- `providers/adapter-retry.ts` — in-adapter retry policy shared by both OpenAI adapters.
- `prompts/classifier-v1.md` + `prompts/prompt-loader.ts` — versioned prompt (frozen; edit → `classifier-v2`) and its loader/renderer.

## Runs (T-070)

- `analysis-state.ts` — state machine (`ANALYSIS_TRANSITIONS`, FR-100).
- `analysis.service.ts` — `AnalysisService`: enqueue with version dedupe (implements the `ANALYSIS_ENQUEUER` port, BR-023/BR-024/FR-116), `claimBatch` (`FOR UPDATE SKIP LOCKED`, FR-101), guarded transitions `markCompleted` / `markSkipped` / `markFailed` / `requeue`, watchdog `requeueStuck`.
- `markCurrentStale` (content change, FR-078) and `markVersionStale(oldVersion, { projectId? })` (version change helper, T-078; endpoint/bulk enqueue are P1).
- `analysis-worker.service.ts` — poll loop; see `../../jobs/README.md`.
- `run-processor.ts` — `ANALYSIS_RUN_PROCESSOR` port; real pipeline in T-074.

## Pipeline (T-074)

`AnalysisPipelineService` implements `RunProcessor` and is bound to `ANALYSIS_RUN_PROCESSOR`, so the worker polls when `APP_ROLE ∈ {worker, all}`. Order and persistence rules: doc 07 §2. Classifier output is validated with one corrective retry (FR-113); other provider errors are rethrown to the worker. Tests: `analysis-pipeline.service.spec.ts`, `test/integration/analysis-pipeline.int-spec.ts`.

## Failure policy & pauses (T-075)

- `analysis-failure-policy.ts` — `decideFailure` (retry / fail / fail_and_pause), `backoffMs`, `AnalysisLockLostError` (doc 07 §8, FR-113).
- `analysis-pause.service.ts` — `AnalysisPauseService.getState()`: daily budget (UTC) and provider-auth pause, read from the DB (doc 07 §9). Port for System Status (T-077).
- Tests: `analysis-failure-policy.spec.ts`, `analysis-worker.service.spec.ts`, `test/integration/analysis-failures.int-spec.ts`.
