# 02 · Backend Design (NestJS)

| Field  | Value                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0)                                                                            |
| Source | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §6, §8–§13, §19 |
| Code   | `apps/api`                                                                                          |

## 1. Layering

```text
Controller (HTTP, DTO validation via Zod pipe, role decorators)
   ↓
Service (use-cases, business rules BR-xxx, transactions)
   ↓
Repository (Prisma access; one repository per aggregate; no Prisma types leak above)
   ↓
Prisma Client → Postgres
```

Cross-cutting: `common/` (guards, interceptors, filters, logger, config schema, errors), `providers/` (external adapters), `jobs/` (scheduler + workers).

## 2. Folder structure

```text
apps/api/src/
├─ main.ts                      bootstrap (helmet, cors, pino, swagger, versioning, shutdown hooks)
├─ app.module.ts
├─ config/                      env schema (zod) + typed ConfigService
├─ common/
│  ├─ auth/                     SupabaseJwtGuard, ProjectRoleGuard, @Roles, @CurrentUser, @ProjectId
│  ├─ errors/                   AppError, error codes, HttpExceptionFilter (→ {error:{code,message,requestId}})
│  ├─ logging/                  pino config, redaction, request-id middleware
│  ├─ pipes/                    ZodValidationPipe
│  ├─ pagination/               cursor helpers (base64 of (sortKey,id))
│  └─ time/                     timezone/window utilities
├─ database/                    PrismaModule, PrismaService, transaction helper, advisory lock helper
├─ modules/
│  ├─ auth/                     /me, profile upsert
│  ├─ projects/                 projects, members, settings
│  ├─ integrations/
│  │  ├─ integrations.controller/service   status, save token (encrypt), verify
│  │  └─ threads/               ThreadsDiscoveryProvider, DTO mappers, error mapper, fixtures
│  ├─ listening-queries/
│  ├─ collector/                scheduler.service (tick), collector.service (run window), window.calculator, ingestion.service (upsert/dedupe/hash), circuit-breaker
│  ├─ sync-jobs/
│  ├─ analysis/
│  │  ├─ analysis-worker.service   claim batch, orchestrate pipeline
│  │  ├─ providers/                SafetyProvider (OpenAiModeration), ContentClassifier (OpenAiStructured, Fake)
│  │  ├─ policy/                   safety-policy.v1.ts (uses packages/taxonomy)
│  │  ├─ schema/                   classifier output zod schema
│  │  └─ analysis.service          enqueue, reanalyze, versions, cost
│  ├─ mentions/
│  ├─ analytics/                 metric queries (SQL via Prisma.$queryRaw with tagged templates), bucketing, compare
│  ├─ system-status/
│  ├─ health/
│  ├─ audit/
│  ├─ reviews/                   P1 overrides
│  └─ export/                    P1 CSV
└─ jobs/                        role bootstrap: registers scheduler/worker only when APP_ROLE ∈ {worker, all}
```

## 3. Module responsibilities

| Module                                 | Owns                                                                                                                                       | Must not                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `AuthModule`                           | JWT verification (Supabase JWKS or `SUPABASE_JWT_SECRET`), `/me`, profile upsert                                                           | hold roles logic beyond membership lookup    |
| `ProjectsModule`                       | projects, members, settings, last-admin rule                                                                                               | —                                            |
| `IntegrationsModule` / `ThreadsModule` | token storage (encrypted), verify, provider adapter, error mapping, rate-limit metadata, fixtures                                          | contain DB analytics or scheduling           |
| `ListeningQueriesModule`               | CRUD, validation (FR-052), duplicates, run/backfill enqueue, term matching helpers                                                         | call the provider directly                   |
| `CollectorModule`                      | tick, claiming, window calc, pagination, normalisation, upsert, matches, change detection, job counters, circuit breaker, enqueue analysis | know model/provider details                  |
| `SyncJobsModule`                       | list/detail/retry of `sync_jobs`                                                                                                           | —                                            |
| `AnalysisModule`                       | queue state machine, providers, policy mapping, schema validation, versioning, dedupe of identical version, cost, retries, reanalyze       | expose provider model names to other modules |
| `MentionsModule`                       | list/detail/search, cursor pagination, effective analysis projection                                                                       | compute analytics                            |
| `AnalyticsModule`                      | metric definitions (doc 07), bucketing, compare, coverage                                                                                  | diverge from doc 07                          |
| `SystemStatusModule`                   | aggregate status per contract, lags                                                                                                        | —                                            |
| `HealthModule`                         | `/health/live`, `/health/ready` (Terminus)                                                                                                 | block readiness on AI providers              |
| `AuditModule`                          | `audit()` helper + list endpoint                                                                                                           | store secrets                                |
| `ReviewsModule` (P1)                   | overrides, review queue                                                                                                                    | —                                            |
| `ExportModule` (P1)                    | CSV streaming with cap                                                                                                                     | —                                            |

## 4. Request lifecycle

1. `RequestIdMiddleware` sets `x-request-id` (uuid v7) → pino child logger.
2. `SupabaseJwtGuard` (global, except `@Public()`): verifies token, loads/creates profile, attaches `req.user`.
3. `ProjectRoleGuard` (on `/projects/:projectId/**`): loads membership, checks `@Roles()`; caches membership per request.
4. `ZodValidationPipe` validates params/query/body with schemas from `@how-about-me/contracts`.
5. Service executes; repository uses Prisma; transactions via `prisma.$transaction` with `isolationLevel` `ReadCommitted` (default) except claiming (`Serializable` not needed thanks to `UPDATE … RETURNING`).
6. `HttpExceptionFilter` maps `AppError`/Zod errors/unknown to the error envelope; 5xx logs stack, response hides it.
7. `LoggingInterceptor` logs `method, path, status, duration_ms, user_id, project_id`.

## 5. Error model

```ts
class AppError extends Error { constructor(public code: ErrorCode, public status: number, message: string, public details?: unknown) }
```

Codes (subset): `VALIDATION_ERROR(400)`, `AUTH_MISSING_TOKEN/INVALID_TOKEN/TOKEN_EXPIRED(401)`, `FORBIDDEN_ROLE/FORBIDDEN_PROJECT(403)`, `NOT_FOUND(404)`, `QUERY_DUPLICATE(409)`, `QUERY_IMMUTABLE_FIELD(400)`, `SYNC_ALREADY_RUNNING(409)`, `LAST_ADMIN(409)`, `THREADS_UNAUTHORIZED/FORBIDDEN/RATE_LIMITED/UPSTREAM_ERROR/TIMEOUT/MALFORMED_RESPONSE(502/503)`, `ANALYSIS_SCHEMA_INVALID(500 internal, stored on run)`, `EXPORT_TOO_LARGE(413)`, `RATE_LIMITED(429)`, `INTERNAL(500)`. Full list lives in `packages/contracts/src/errors.ts`.

## 6. Scheduling & workers

- `@nestjs/schedule` `@Interval(60_000)` on `SchedulerService.tick()` only when `APP_ROLE ∈ {worker, all}`.
- Tick: `claimDueQueries(limit = COLLECTOR_MAX_CONCURRENT_QUERIES)` → run sequentially per instance (bounded concurrency `p-limit`), each in its own try/catch; never let one query's failure abort the tick.
- `AnalysisWorkerService` `@Interval(ANALYSIS_POLL_MS=5000)`: claim batch, process with bounded concurrency (`ANALYSIS_CONCURRENCY=3`).
- Graceful shutdown: `enableShutdownHooks`; workers finish current page/item, release locks.
- Claiming SQL (queries):

```sql
UPDATE listening_queries q SET locked_at = now(), locked_by = $worker
WHERE q.id IN (
  SELECT id FROM listening_queries
  WHERE enabled AND deleted_at IS NULL AND next_run_at <= now()
    AND (locked_at IS NULL OR locked_at < now() - ($stale)::interval)
  ORDER BY next_run_at LIMIT $limit FOR UPDATE SKIP LOCKED)
RETURNING q.*;
```

Analysis runs use the same pattern on `analysis_runs` with `status='pending'`.

## 7. Configuration

Typed with Zod in `config/env.schema.ts`; app fails fast on invalid env. See [../06-engineering/06-environment-variables.md](../06-engineering/06-environment-variables.md). Provider models, thresholds, retry counts, caps are all env-driven with defaults.

## 8. Database access

- Prisma 6 with `DATABASE_URL` (pooled, transaction mode, `pgbouncer=true`) and `DIRECT_URL` (session, for migrations).
- Pool size conservative (`connection_limit=10` API, `5` worker).
- Raw SQL (tagged `Prisma.sql`) for analytics and claiming; Prisma client for CRUD.
- `effective_post_analysis` view created by migration SQL; read via `$queryRaw` typed with Zod.

## 9. API documentation

`@nestjs/swagger` builds OpenAPI at `/api/docs` (disabled in production unless `SWAGGER_ENABLED=true`). DTO schemas come from Zod via `nestjs-zod`-style `createZodDto` wrappers in `packages/contracts`.

## 10. Testing hooks

- `FakeThreadsProvider` (fixture-driven, supports pagination/errors), `FakeSafetyProvider`, `FakeContentClassifier` selectable with `PROVIDERS_MODE=fake` for local/e2e.
- Test DB via Docker Postgres; Jest `globalSetup` runs `prisma migrate deploy`.
