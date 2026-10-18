# integrations module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `integrations`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Threads integration (T-038)

- `integrations.controller.ts` — `GET|PUT|DELETE /projects/:projectId/integrations/threads`, `POST …/verify` (contract: docs/02-architecture/05-api-contract.md §4).
- `integrations.service.ts` — status flow and verify error → status mapping (`statusForVerifyError`).
- `threads/threads-token.store.ts` — `ThreadsTokenStore` (DI token `THREADS_TOKEN_STORE`, interface `TokenStore`): the only reader of `integration_secrets`; encrypts via `CryptoService` with the connection id as AAD. Exported for the collector (T-052).
- Fake provider token sentinels: `fake-invalid…` → `THREADS_UNAUTHORIZED`, `fake-forbidden…` → `THREADS_FORBIDDEN`.
