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

1. pino-http `genReqId` (`common/logging/request-id.ts`) reuses the client `x-request-id` only if it matches `^[A-Za-z0-9._:-]{1,128}$`, otherwise generates a uuid v7; the id is echoed in the `x-request-id` response header, bound to `req.log` as `request_id` and used as `requestId` in error envelopes.
2. `SupabaseJwtGuard` (global, except `@Public()`): verifies token, loads/creates profile, attaches `req.user`.
3. `ProjectRoleGuard` (on `/projects/:projectId/**`): loads membership, checks `@Roles()`; caches membership per request.
4. `ZodValidationPipe` validates params/query/body with schemas from `@how-about-me/contracts`.
5. Service executes; repository uses Prisma; transactions via `prisma.$transaction` with `isolationLevel` `ReadCommitted` (default) except claiming (`Serializable` not needed thanks to `UPDATE … RETURNING`).
6. `HttpExceptionFilter` maps `AppError`/Zod errors/unknown to the error envelope; 5xx logs stack, response hides it (see §5).
7. pino-http autoLogging (no separate interceptor) logs one line per request with `request_id, duration_ms, user_id, project_id, app_role, version` (`customProps` evaluated on response finish; `/health` and `/metrics` skipped).

## 5. Error model

```ts
class AppError extends Error {
  constructor(code: ErrorCode, message?: string, details?: unknown, status?: number); /* default ERROR_CODES[code] */
}
```

- Zod failures → `400 VALIDATION_ERROR` with `details.issues: [{ path: "items.0.name", message, code }]`.
- Nest `HttpException` 4xx keep their message (arrays joined with `"; "`); 401→`AUTH_INVALID_TOKEN`, 403→`FORBIDDEN_ROLE`, 404→`NOT_FOUND`, 429→`RATE_LIMITED`, other 4xx (405/409/413…) → `VALIDATION_ERROR` until dedicated codes exist.
- Non-`AppError` 5xx: message is always `"Internal server error"`, never a stack. `production`/`staging` add no `details`; `development`/`test` add `details.debug.message`. `AppError` 5xx (e.g. `THREADS_*`) keep their message.
- Exception: Terminus `/health/ready` 503 body (`{status, info, error, details}`) is passed through unwrapped.

Codes (subset): `VALIDATION_ERROR(400)`, `AUTH_MISSING_TOKEN/INVALID_TOKEN/TOKEN_EXPIRED(401)`, `FORBIDDEN_ROLE/FORBIDDEN_PROJECT(403)`, `NOT_FOUND(404)`, `QUERY_DUPLICATE(409)`, `QUERY_IMMUTABLE_FIELD(400)`, `SYNC_ALREADY_RUNNING(409)`, `LAST_ADMIN(409)`, `MEMBER_EXISTS(409)`, `THREADS_UNAUTHORIZED/FORBIDDEN/RATE_LIMITED/UPSTREAM_ERROR/TIMEOUT/MALFORMED_RESPONSE(502/503)`, `ANALYSIS_SCHEMA_INVALID(500 internal, stored on run)`, `EXPORT_TOO_LARGE(413)`, `RATE_LIMITED(429)`, `INTERNAL(500)`. Full list lives in `packages/contracts/src/errors.ts`.

## 6. Scheduling & workers

- Collector tick (T-048, `apps/api/src/jobs/`): `SchedulerService` registers interval `collector-tick` every `COLLECTOR_TICK_MS` (default 60 000) via `SchedulerRegistry`, only when `APP_ROLE ∈ {worker, all}`. Overlapping ticks in one instance are skipped.
- Tick: `QueryClaimRepository.claimDueQueries(workerId, limit = COLLECTOR_MAX_CONCURRENT_QUERIES, COLLECTOR_LOCK_STALE_MINUTES)` → run each claimed query through the `COLLECTOR_RUNNER` token (bounded concurrency via the in-repo `runWithConcurrency` helper), each in its own try/catch; a thrown error counts as `failed` (`last_error_code` = `AppError.code` or `INTERNAL`). Never let one query's failure abort the tick. `COLLECTOR_RUNNER` is bound to `null` until T-052 binds `CollectorService`; with no runner the tick is not registered (no claims, no `next_run_at`/`last_run_at` moved by runs that never happened).
- After each run `computeNextRunAt` (ingestion §3) → `completeRun` writes `next_run_at`, `consecutive_failures`, `last_run_at`, `last_error_*` and clears the lock **only `WHERE locked_by = $worker`** (a worker whose stale lock was re-claimed writes nothing). The guard only prevents overwrites: a run longer than `COLLECTOR_LOCK_STALE_MINUTES` can still be re-claimed and run twice, so the T-052 runner must heartbeat `locked_at` or bound its pages per run. The runner also owns `sync_jobs` (create the scheduled job, move the claimed `manualJobId` from `queued` to `running`); otherwise a queued manual job keeps its query due on every tick.
- `AnalysisWorkerService` registers its interval (`ANALYSIS_POLL_MS=5000`) through `SchedulerRegistry` on bootstrap, only when `APP_ROLE ∈ {worker, all}`, `NODE_ENV ≠ test` and a `RunProcessor` (`ANALYSIS_RUN_PROCESSOR`, T-074) is bound. Tick: watchdog `requeueStuck()` → pause check (auth / budget, `AnalysisPauseService`, T-075) → `claimBatch(ANALYSIS_BATCH_SIZE)` (only `manual` when budget-paused) → process with bounded concurrency (`ANALYSIS_CONCURRENCY=3`); overlapping ticks are skipped. On shutdown it stops polling and waits up to 10 s for the current batch.
- Retention job (T-153, `jobs/retention-job.service.ts`): `CronJob` `retention-job` (`RETENTION_JOB_CRON`, default Sunday 03:00 `Asia/Ho_Chi_Minh`) registered via `SchedulerRegistry` only when `RETENTION_JOB_MODE ≠ off`, `APP_ROLE ∈ {worker, all}` and `NODE_ENV ≠ test`. Logs dry-run counts per scope, deletes only in `apply` mode — see docs/05-operations/04-data-retention-purge.md.
- Graceful shutdown: `enableShutdownHooks`; workers finish current page/item, release locks (`releaseLocks(workerId)`, wait ≤ 30 s for the in-flight tick).
- Claiming SQL (queries) — due = `next_run_at <= now()`, `next_run_at IS NULL` (new query) or a queued manual job; manual first (FR-058); projects with an open circuit or without a `connected` Threads integration are skipped:

```sql
UPDATE listening_queries q SET locked_at = now(), locked_by = $worker
FROM (
  SELECT lq.id, mj.id AS manual_job_id FROM listening_queries lq
  LEFT JOIN LATERAL (SELECT sj.id FROM sync_jobs sj
     WHERE sj.query_id = lq.id AND sj.status = 'queued' AND sj.trigger = 'manual'
     ORDER BY sj.created_at LIMIT 1) mj ON true
  WHERE lq.enabled AND lq.deleted_at IS NULL
    AND (lq.next_run_at IS NULL OR lq.next_run_at <= now() OR mj.id IS NOT NULL)
    AND (lq.locked_at IS NULL OR lq.locked_at < now() - make_interval(mins => $stale))
    AND NOT EXISTS (SELECT 1 FROM collector_state cs WHERE cs.project_id = lq.project_id AND cs.circuit_open_until > now())
    AND EXISTS (SELECT 1 FROM integration_connections ic WHERE ic.project_id = lq.project_id AND ic.platform = 'threads' AND ic.status = 'connected')
  ORDER BY (mj.id IS NOT NULL) DESC, lq.next_run_at NULLS FIRST
  LIMIT $limit FOR UPDATE OF lq SKIP LOCKED) c
WHERE q.id = c.id
RETURNING q.id, q.project_id, q.poll_interval_seconds, q.consecutive_failures, q.next_run_at, c.manual_job_id;
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

`@nestjs/swagger` builds OpenAPI at `/api/docs` (`SWAGGER_ENABLED` unset → on outside production, off in production; `SWAGGER_ENABLED=true` enables it anywhere). Generating DTO schemas from Zod (`createZodDto`-style wrappers in `packages/contracts`) is a follow-up ticket; currently only controller metadata is documented.

## 10. Testing hooks

- `FakeThreadsProvider` (fixture-driven, supports pagination/errors), `FakeSafetyProvider`, `FakeContentClassifier` selectable with `PROVIDERS_MODE=fake` for local/e2e.
- Test DB via Docker Postgres; Jest `globalSetup` runs `prisma migrate deploy`.
