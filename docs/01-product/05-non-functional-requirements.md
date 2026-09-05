# 05 · Non-Functional Requirements

| Field  | Value                                                                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0)                                                                                                                                                                       |
| Source | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §14–§22, §24–§25 · [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §19–§20 |

Targets are product targets for the internal MVP, measured on staging with a seeded dataset of **100 000 posts / 120 000 analyses** unless stated otherwise.

## NFR-00x · Performance

| ID      | Requirement            | Target                                                                                 | How verified                            |
| ------- | ---------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| NFR-001 | Overview API latency   | p95 < 1.5 s for 24 h / 7 d ranges with default filters                                 | k6/autocannon on staging, 20 VU         |
| NFR-002 | Mentions list latency  | p95 < 1.0 s for indexed filters, 25 items                                              | same                                    |
| NFR-003 | Mention detail latency | p95 < 700 ms                                                                           | same                                    |
| NFR-004 | FE dashboard usable    | < 2.5 s to interactive after auth on office broadband                                  | Lighthouse / WebPageTest, cache warm    |
| NFR-005 | Collector non-blocking | Collector & analyzer never run on HTTP request threads; long jobs are chunked per page | code review + load test while sync runs |
| NFR-006 | Timeseries query       | ≤ 366 daily buckets or ≤ 48 hourly buckets returned zero-filled                        | unit test                               |
| NFR-007 | Text search            | `q` filter p95 < 1.5 s at 100 k posts via GIN FTS                                      | perf test                               |

## NFR-01x · Security

| ID      | Requirement                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| NFR-010 | No Supabase service-role key, Threads token or OpenAI key in browser bundles or FE env (`NEXT_PUBLIC_*` audit in CI).        |
| NFR-011 | All API routes require a valid Supabase JWT except `/health/*`.                                                              |
| NFR-012 | RBAC enforced server-side on every mutation (FR-015).                                                                        |
| NFR-013 | Provider tokens encrypted at rest (AES-256-GCM); encryption key rotated without code change (key id stored with ciphertext). |
| NFR-014 | Secrets never logged; logger redacts `authorization`, `token`, `apiKey`, `secret`, `password` keys.                          |
| NFR-015 | Input validation on every body/query via Zod (contracts) → `400 VALIDATION_ERROR` with field paths.                          |
| NFR-016 | Production CORS restricted to the web origin; `helmet` defaults enabled.                                                     |
| NFR-017 | Rate limiting for admin heavy actions: run-now 10/min/project, bulk re-analysis 1/5 min/project, export 5/min/user.          |
| NFR-018 | Content rendered as text; external links `noopener noreferrer`.                                                              |
| NFR-019 | Dependency vulnerability scan in CI (`pnpm audit --prod` high+ fails build; allow-list documented).                          |

## NFR-02x · Reliability & data integrity

| ID      | Requirement                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| NFR-020 | Application availability target 99.5 % (internal).                                                                           |
| NFR-021 | Ingestion failures are recoverable via overlap + backfill; no data corruption on provider failure (page-level transactions). |
| NFR-022 | Idempotent writes: uniqueness constraints on posts and matches; re-running any job yields no duplicates.                     |
| NFR-023 | Analytics eventually consistent; UI shows pending/failed coverage.                                                           |
| NFR-024 | Scheduler safe with ≥ 2 instances (DB claiming).                                                                             |
| NFR-025 | Daily DB backups (Supabase Pro) verified quarterly by restore drill on staging.                                              |

## NFR-03x · Usability & accessibility

| ID      | Requirement                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| NFR-030 | Untitled UI as component system; consistent semantic badges for sentiment/safety with icon + text, never colour alone. |
| NFR-031 | Keyboard navigable; visible focus; labelled controls; React Aria primitives.                                           |
| NFR-032 | WCAG 2.1 AA contrast for text and badges; charts provide tooltip/table access to values.                               |
| NFR-033 | Responsive from 1280 px desktop down to 768 px tablet; mobile read-only acceptable.                                    |
| NFR-034 | Every percentage KPI shows its denominator/definition on hover.                                                        |
| NFR-035 | Strong empty/loading/error states on every screen (see UX spec).                                                       |

## NFR-04x · Scalability & capacity

| ID      | Requirement                                                                         |
| ------- | ----------------------------------------------------------------------------------- |
| NFR-040 | Schema supports hundreds of queries and millions of posts; indexes per data model.  |
| NFR-041 | API horizontally scalable (stateless); worker scalable separately via `APP_ROLE=api | worker | all`. |
| NFR-042 | Aggregate tables introduced only when raw queries exceed NFR-001 (P1.5 trigger).    |
| NFR-043 | Storage growth metric `average_storage_bytes_per_post` reported monthly.            |

## NFR-05x · Observability & operations

| ID      | Requirement                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-050 | Structured JSON logs with `request_id`, `job_id`, `query_id`, `project_id`.                                                                 |
| NFR-051 | Metrics: sync success rate, provider latency, inserted/duplicates, rate-limit events, analysis queue depth, failures, AI cost, API p50/p95. |
| NFR-052 | `/health/live`, `/health/ready`.                                                                                                            |
| NFR-053 | Runbook covers token expiry, failed sync, backfill, re-analysis, purge.                                                                     |
| NFR-054 | Retention configurable: posts+analysis 12 mo, sync jobs 180 d, app logs 30–90 d, audit 12+ mo; purge tooling by post/project/date.          |

## NFR-06x · Engineering & delivery

| ID      | Requirement                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| NFR-060 | Monorepo (pnpm + Turborepo) with shared contracts/taxonomy; TypeScript strict everywhere.                                      |
| NFR-061 | CI on every PR: lint, typecheck, unit/integration tests, build; required before merge to `develop`/`main`.                     |
| NFR-062 | Environments `local`, `staging`, `production` with isolated Supabase projects, Meta tokens, AI keys.                           |
| NFR-063 | Prisma migrations versioned; no manual production schema edits; seeds idempotent.                                              |
| NFR-064 | Shared Zod contracts for all API DTOs; OpenAPI generated from NestJS decorators.                                               |
| NFR-065 | Test coverage: ≥ 80 % lines on `apps/api/src/modules/**` domain services; contract fixtures for Threads; E2E smoke on staging. |
| NFR-066 | Conventional commits, gitflow branches, PR template & review checklist (see engineering handbook).                             |

## NFR-07x · Compliance & data

| ID      | Requirement                                                                          |
| ------- | ------------------------------------------------------------------------------------ |
| NFR-070 | Official API only; retention verified against Meta Platform Terms before production. |
| NFR-071 | Data minimisation: only requested fields; no profile enrichment; no media binaries.  |
| NFR-072 | Purge by post / project / date range available to Admin via CLI or endpoint (P1 UI). |
| NFR-073 | Timestamps stored UTC (`timestamptz`), displayed in project/user timezone.           |
| NFR-074 | Docs updated in the same PR as behaviour changes (Definition of Done).               |
