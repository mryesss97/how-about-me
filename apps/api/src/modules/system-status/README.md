# system-status module

`GET /projects/:projectId/system-status` (T-057, FR-171/FR-176). Read-only, any project member.

- `system-status.rules.ts` — pure status rules (lag, success rate, collector status), docs/02-architecture/09-observability.md §4.
- `system-status.repository.ts` — aggregates from `integration_connections` (never secrets), `listening_queries`, `sync_jobs`, `pg_class`, `_prisma_migrations`.
- `system-status.service.ts` — assembles the `SystemStatusResponse` DTO; circuit state via `CircuitBreakerService` (FR-084). `analysis` is a stub until T-077.

Contract: docs/02-architecture/05-api-contract.md §10. Conventions: docs/06-engineering/03-coding-conventions.md §2.
