# analysis module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `analysis`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Providers

- `providers/fake-safety.provider.ts`, `providers/fake-classifier.provider.ts` — offline fakes (`PROVIDERS_MODE=fake`, T-013).
- `providers/openai-moderation.provider.ts` — real `SafetyProvider` over OpenAI `/v1/moderations` (T-071), HTTP via `providers/openai-http.ts`.
- `safety/safety-mapping.ts` — `toSafetyAnalysis()` maps a provider result to the persisted safety fields (BR-017, BR-018).
- Real classifier: T-072.
