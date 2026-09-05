# 04 · Functional Requirements Catalogue

| Field   | Value                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Approved (baseline v1.0)                                                                                                                                                                                                                          |
| Source  | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md), [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md), [00-source/03_DATA_MODEL_AND_API.md](../00-source/03_DATA_MODEL_AND_API.md) |
| Stories | [03-user-stories.md](03-user-stories.md)                                                                                                                                                                                                          |
| Tests   | [../04-qa/test-cases/](../04-qa/test-cases/)                                                                                                                                                                                                      |

Each requirement is atomic, testable and has a priority. "Verify" names the test-case file prefix.

## FR-01x · Authentication & RBAC

| ID     | Requirement                                                                                                                                                  | Pri | Stories        | Verify  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------- | ------- |
| FR-010 | The system SHALL authenticate users via Supabase Auth (email/password or magic link).                                                                        | P0  | US-001         | TC-AUTH |
| FR-011 | The FE SHALL attach `Authorization: Bearer <JWT>` to every API request and SHALL clear session state on sign-out.                                            | P0  | US-001, US-007 | TC-AUTH |
| FR-012 | The system MAY support Google OAuth via Supabase when enabled by configuration.                                                                              | P1  | US-002         | TC-AUTH |
| FR-013 | The API SHALL reject requests with missing, invalid or expired tokens with `401` and codes `AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN`, `AUTH_TOKEN_EXPIRED`. | P0  | US-001, US-003 | TC-AUTH |
| FR-014 | The API SHALL resolve the caller's role per project from `project_members` on every request.                                                                 | P0  | US-003         | TC-AUTH |
| FR-015 | Every mutating endpoint SHALL declare allowed roles; violations return `403 FORBIDDEN_ROLE`.                                                                 | P0  | US-003         | TC-AUTH |
| FR-016 | Requests for a project the caller is not a member of SHALL return `403 FORBIDDEN_PROJECT` without leaking existence details.                                 | P0  | US-003         | TC-AUTH |
| FR-017 | On first authenticated request the API SHALL upsert `user_profiles` from JWT claims.                                                                         | P0  | US-004         | TC-AUTH |
| FR-018 | The FE SHALL hide navigation/actions not permitted by role and SHALL render an access-denied state for deep links.                                           | P0  | US-005, US-008 | TC-AUTH |
| FR-019 | Seeding SHALL create the first Admin membership from `SEED_ADMIN_EMAIL`.                                                                                     | P0  | US-006         | TC-AUTH |

## FR-03x · Monitoring Project & Members

| ID     | Requirement                                                                                                                                      | Pri | Stories        | Verify  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------- | ------- |
| FR-030 | Seed SHALL create project `1Zone / Eventista Social Listening`, slug `1zone-eventista`, timezone `Asia/Ho_Chi_Minh`, active. Seed is idempotent. | P0  | US-010         | TC-PROJ |
| FR-031 | `GET /projects` SHALL return only projects the caller belongs to, with role.                                                                     | P0  | US-011         | TC-PROJ |
| FR-032 | Admin SHALL be able to update `name`, `timezone` (valid IANA) and settings `allowAnalystReanalyze`, `allowViewerExport`.                         | P0  | US-012, US-143 | TC-PROJ |
| FR-033 | Admin SHALL add a member by email with a role; a profile is created lazily.                                                                      | P0  | US-013         | TC-PROJ |
| FR-034 | Admin SHALL change a member's role or remove a member; effect is immediate.                                                                      | P0  | US-013         | TC-PROJ |
| FR-035 | The system SHALL prevent removing/downgrading the last Admin (`409 LAST_ADMIN`).                                                                 | P0  | US-013         | TC-PROJ |
| FR-036 | The FE SHALL hide the project switcher when the user has exactly one project.                                                                    | P0  | US-014         | TC-PROJ |

## FR-04x · Threads Integration

| ID     | Requirement                                                                                                                                         | Pri | Stories | Verify         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- | -------------- |
| FR-040 | Admin SHALL store the Threads access token via API; the token is encrypted at rest (AES-256-GCM, key from env) in `integration_secrets`.            | P0  | US-020  | TC-INT         |
| FR-041 | The API SHALL never return token values; logs SHALL redact them.                                                                                    | P0  | US-020  | TC-INT         |
| FR-042 | Admin SHALL trigger a verification call updating `status`, `last_verified_at`, `account_identifier`, `granted_scopes`, `token_expires_at`.          | P0  | US-021  | TC-INT         |
| FR-043 | Only Admin may write integration settings; Analyst/Viewer may read status.                                                                          | P0  | US-020  | TC-INT         |
| FR-044 | Integration status SHALL expose `connected \| expired \| permission_error \| error \| disconnected`, last success, last error code/message.         | P0  | US-022  | TC-INT         |
| FR-045 | On provider `401/403` the system SHALL set status `expired`/`permission_error`, pause scheduling for the project and surface it in System Status.   | P0  | US-023  | TC-INT, TC-COL |
| FR-046 | When the provider supports long-lived token refresh, the system SHALL refresh tokens expiring within 7 days daily and audit failures.               | P0* | US-024  | TC-INT         |
| FR-047 | All Threads API calls SHALL go through `ThreadsDiscoveryProvider implements SocialDiscoveryProvider`; other modules only use provider-neutral DTOs. | P0  | US-025  | TC-COL         |
| FR-048 | A POC report per template SHALL be produced and accepted before M2 ingestion requirements are frozen.                                               | P0  | US-026  | —              |

\* P0 if Meta's flow requires it (validated in POC).

## FR-05x/06x · Listening Queries

| ID     | Requirement                                                                                                                                                                                                                                                                                   | Pri | Stories        | Verify        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------- | ------------- |
| FR-050 | Seed SHALL create 4 enabled queries: `1zone`/KEYWORD, `1zone`/TAG, `eventista`/KEYWORD, `eventista`/TAG; `#` not persisted.                                                                                                                                                                   | P0  | US-030         | TC-LQ         |
| FR-051 | `GET …/listening-queries` SHALL list non-deleted queries (optionally deleted) with sync summary fields.                                                                                                                                                                                       | P0  | US-031, US-039 | TC-LQ         |
| FR-052 | `POST` SHALL validate: `displayName` 1–80 chars; `queryValue` 1–100 chars, trimmed, leading `#` stripped; `queryType ∈ {keyword, topic_tag}`; `pollIntervalSeconds` 60–86400; `overlapSeconds` 0–86400; `excludeTerms/includeTerms` ≤ 50 items, each ≤ 100 chars; `initialBackfillDays` 0–30. | P0  | US-032         | TC-LQ         |
| FR-053 | Duplicate `(project_id, platform, query_type, lower(query_value))` among non-deleted queries SHALL return `409 QUERY_DUPLICATE`.                                                                                                                                                              | P0  | US-032         | TC-LQ         |
| FR-054 | `PATCH` SHALL allow `displayName, excludeTerms, includeTerms, pollIntervalSeconds, overlapSeconds, enabled`; `queryValue/queryType` immutable (`400 QUERY_IMMUTABLE_FIELD`).                                                                                                                  | P0  | US-033         | TC-LQ         |
| FR-055 | Disabling SHALL stop scheduling; enabling SHALL set `next_run_at = now()`.                                                                                                                                                                                                                    | P0  | US-034         | TC-LQ         |
| FR-056 | Creating an enabled query SHALL set `next_run_at = now()`.                                                                                                                                                                                                                                    | P0  | US-032         | TC-LQ         |
| FR-057 | `DELETE` SHALL soft delete (`deleted_at`); `POST …/restore` SHALL clear it; history preserved.                                                                                                                                                                                                | P0  | US-035         | TC-LQ         |
| FR-058 | `POST …/run` SHALL enqueue a sync job and return `{jobId, status:"queued"}`; `409 SYNC_ALREADY_RUNNING` if one is running.                                                                                                                                                                    | P0  | US-036         | TC-LQ         |
| FR-059 | Exclude terms SHALL be applied post-ingestion: case-insensitive, NFC-normalised substring match; matching posts are stored but the match row is `excluded_by_terms=true` and not counted.                                                                                                     | P0  | US-037         | TC-LQ, TC-COL |
| FR-060 | Include terms (optional) SHALL require ≥ 1 term present; otherwise treated as excluded for that query.                                                                                                                                                                                        | P0  | US-038         | TC-LQ         |
| FR-061 | Query list SHALL show last successful sync, last error, matched post counts (all-time, 24 h).                                                                                                                                                                                                 | P0  | US-039         | TC-LQ         |
| FR-062 | "View mentions" SHALL navigate to `/mentions?queryIds=<id>`.                                                                                                                                                                                                                                  | P0  | US-040         | TC-LQ         |
| FR-063 | `POST …/backfill {since, until, searchType?}` SHALL validate and enqueue a backfill job; window ≤ `COLLECTOR_MAX_BACKFILL_DAYS`.                                                                                                                                                              | P1  | US-041, US-155 | TC-LQ         |

## FR-07x/08x · Collector & Sync Jobs

| ID     | Requirement                                                                                                                                                                         | Pri | Stories | Verify         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- | -------------- |
| FR-070 | A scheduler tick SHALL run every 60 s and select due queries (`enabled AND deleted_at IS NULL AND next_run_at <= now()`).                                                           | P0  | US-050  | TC-COL         |
| FR-071 | After each run `next_run_at` SHALL be set to `completed_at + poll_interval_seconds` (success) or backoff (failure).                                                                 | P0  | US-050  | TC-COL         |
| FR-072 | Window: `since = last_successful_sync_at − overlap`, `until = now()`; first run `since = now() − initialBackfillDays` (default 1 day); clamped to provider max.                     | P0  | US-051  | TC-COL         |
| FR-073 | The collector SHALL follow cursor pagination until exhausted or `COLLECTOR_MAX_PAGES_PER_JOB`; cap → `partial` with `last_cursor`.                                                  | P0  | US-052  | TC-COL         |
| FR-074 | Provider items SHALL be normalised into `NormalizedPost`; items lacking `id` or `timestamp` are counted invalid and skipped.                                                        | P0  | US-053  | TC-COL         |
| FR-075 | `content_hash = sha256(NFC(text) + '\|' + media_type + '\|' + link_attachment_url)`.                                                                                                | P0  | US-053  | TC-COL         |
| FR-076 | Posts SHALL be unique on `(platform, platform_post_id)`; upsert semantics: unchanged → `last_seen_at` only.                                                                         | P0  | US-054  | TC-COL         |
| FR-077 | Query matches SHALL be unique on `(post_id, query_id)`; a post matched by N queries is stored once with N match rows.                                                               | P0  | US-054  | TC-COL         |
| FR-078 | Changed `content_hash` SHALL update content, `revision++`, mark current analysis `stale`, queue new analysis.                                                                       | P0  | US-055  | TC-COL         |
| FR-079 | `raw_data` SHALL contain only requested provider fields; > 32 KB truncated with `raw_truncated=true`.                                                                               | P0  | US-056  | TC-COL         |
| FR-080 | Each run SHALL persist a `sync_jobs` row with counters and timings per data model.                                                                                                  | P0  | US-057  | TC-COL         |
| FR-081 | `GET …/sync-jobs` (filters: queryId, status, from/to; cursor) and `GET …/sync-jobs/:id`.                                                                                            | P0  | US-058  | TC-COL         |
| FR-082 | Provider errors SHALL map to `THREADS_UNAUTHORIZED, THREADS_FORBIDDEN, THREADS_RATE_LIMITED, THREADS_UPSTREAM_ERROR, THREADS_TIMEOUT, THREADS_MALFORMED_RESPONSE`.                  | P0  | US-059  | TC-COL         |
| FR-083 | Transient errors (429/5xx/timeout) SHALL retry ≤ `COLLECTOR_MAX_RETRIES` with exponential backoff + full jitter, honouring `Retry-After`; 400/401/403 SHALL not be blindly retried. | P0  | US-060  | TC-COL         |
| FR-084 | After N consecutive provider failures the collector SHALL open a circuit for T seconds and report `paused`.                                                                         | P0  | US-061  | TC-COL         |
| FR-085 | Provider 401/403 SHALL fail the job with the mapped code and update integration status (FR-045).                                                                                    | P0  | US-023  | TC-COL         |
| FR-086 | Query execution SHALL be claimed atomically in DB (`locked_at/locked_by`, stale threshold) so concurrent workers never double-run.                                                  | P0  | US-062  | TC-COL         |
| FR-087 | Page-level commits: a failure after successful pages SHALL yield `partial` with data kept and `last_cursor` stored.                                                                 | P0  | US-063  | TC-COL         |
| FR-088 | New or changed posts SHALL be queued for analysis exactly once per revision.                                                                                                        | P0  | US-054  | TC-COL, TC-ANA |
| FR-089 | Rate-limit headers/usage signals SHALL be recorded on the job (`rate_limit_events`, and `provider_usage jsonb` when present).                                                       | P0  | US-057  | TC-COL         |

## FR-10x/11x · Content Intelligence

| ID     | Requirement                                                                                                                                                 | Pri | Stories        | Verify         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------- | -------------- |
| FR-100 | Analysis SHALL follow the state machine `pending → processing → completed \| failed \| skipped`; `stale` marks superseded results.                          | P0  | US-070         | TC-ANA         |
| FR-101 | The analysis worker SHALL claim pending runs in batches with DB claiming and re-queue `processing` older than 10 min.                                       | P0  | US-070         | TC-ANA         |
| FR-102 | Relevance SHALL be `relevant \| uncertain \| irrelevant` with `confidence ∈ [0,1]` and `explanation ≤ 200 chars`.                                           | P0  | US-071         | TC-ANA         |
| FR-103 | `irrelevant` posts SHALL skip the structured classifier and summary (cost gate) and complete with `skipped_reason`.                                         | P0  | US-072         | TC-ANA         |
| FR-104 | Safety SHALL call `SafetyProvider` (OpenAI `omni-moderation-latest` initially) and store flagged, category scores JSONB.                                    | P0  | US-073         | TC-ANA         |
| FR-105 | Safety level SHALL be derived from policy v1 (versioned, configurable) into `safe \| sensitive \| severe`.                                                  | P0  | US-073         | TC-ANA         |
| FR-106 | Sentiment SHALL be `positive \| neutral \| negative` with confidence.                                                                                       | P0  | US-074         | TC-ANA         |
| FR-107 | Intents SHALL be multi-label from taxonomy v1, each with confidence; ≥ 1 label (`other` allowed).                                                           | P0  | US-074         | TC-ANA         |
| FR-108 | Topics SHALL be multi-label from taxonomy v1, each with confidence; ≥ 1 label.                                                                              | P0  | US-074         | TC-ANA         |
| FR-109 | Language SHALL be ISO 639-1 in `{vi,en,ko,ja,th,zh}` else `other`/`unknown`.                                                                                | P0  | US-075         | TC-ANA         |
| FR-110 | Summary SHALL be one sentence ≤ 240 chars for relevant/uncertain content; skipped for empty text, irrelevant, or spam when configured.                      | P0  | US-076         | TC-ANA         |
| FR-111 | Each run SHALL persist provider/model/prompt/taxonomy/safety policy versions and `analyzed_at`.                                                             | P0  | US-077         | TC-ANA         |
| FR-112 | Providers SHALL be injected behind `SafetyProvider` and `ContentClassifier`; model names come from config; a fake provider exists for tests.                | P0  | US-078         | TC-ANA         |
| FR-113 | Provider transient failures SHALL retry ≤ 3 with backoff; schema-invalid output SHALL retry once with correction then `failed` (`ANALYSIS_SCHEMA_INVALID`). | P0  | US-074, US-079 | TC-ANA         |
| FR-114 | `social_posts.current_analysis_id` SHALL point to the latest completed run and be updated transactionally.                                                  | P0  | US-080         | TC-ANA         |
| FR-115 | `POST …/mentions/:id/reanalyze` SHALL create a new run (force) and audit.                                                                                   | P0  | US-081         | TC-ANA, TC-MEN |
| FR-116 | The system SHALL not run analysis for an identical `(source_content_hash, effective_version)` unless forced.                                                | P0  | US-082         | TC-ANA         |
| FR-117 | Runs SHALL record input/output tokens and estimated cost.                                                                                                   | P0  | US-083         | TC-ANA         |
| FR-118 | Prompt/taxonomy v1 SHALL be evaluated on the labelled dataset with per-dimension accuracy before freeze.                                                    | P0  | US-084         | TC-ANA         |
| FR-119 | Classifier output SHALL be validated against the JSON schema; unknown labels rejected unless a taxonomy migration allows them.                              | P0  | US-074         | TC-ANA         |

## FR-13x/14x · Analytics

| ID     | Requirement                                                                                                                                                      | Pri  | Stories        | Verify  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------- | ------- |
| FR-130 | Analytics endpoints SHALL accept `from, to, timezone, queryIds[], sentiment[], safety[], intent[], topic[], language[], relevance[], analysisStatus[], compare`. | P0   | US-090         | TC-DASH |
| FR-131 | Presets 1h/24h/7d/30d/custom; custom ≤ 366 days; default relevance filter `relevant`.                                                                            | P0   | US-091         | TC-DASH |
| FR-132 | Overview SHALL return KPIs: `mentionCount, mentionGrowthPct, positiveRate, negativeRate, safetyRiskRate, complaintRate` computed per metric definitions.         | P0   | US-092         | TC-DASH |
| FR-133 | `mentionGrowthPct` SHALL be `null` with `growthState:"new"` when previous = 0.                                                                                   | P0   | US-092         | TC-DASH |
| FR-134 | Overview SHALL return `coverage {relevantMentions, analyzedMentions, pendingMentions, failedMentions}` plus `dataQuality {lastSyncStatus, integrationStatus}`.   | P0   | US-093         | TC-DASH |
| FR-135 | Timeseries SHALL bucket by `hour` when range ≤ 48 h else `day`, in the requested timezone, zero-filled.                                                          | P0   | US-094         | TC-DASH |
| FR-136 | Sentiment distribution & timeseries.                                                                                                                             | P0   | US-095, US-096 | TC-DASH |
| FR-137 | Safety distribution.                                                                                                                                             | P0   | US-097         | TC-DASH |
| FR-138 | Top topics (distinct post count per label, top 12).                                                                                                              | P0   | US-098         | TC-DASH |
| FR-139 | Intent distribution (distinct post count per label).                                                                                                             | P0   | US-099         | TC-DASH |
| FR-140 | All distributions SHALL include the denominator used.                                                                                                            | P0   | US-092         | TC-DASH |
| FR-141 | `compare=true` SHALL compute the immediately preceding equal-length window aligned to timezone.                                                                  | P0   | US-100         | TC-DASH |
| FR-142 | Every KPI/segment SHALL map to a Mentions filter set that returns exactly the counted posts.                                                                     | P0   | US-101         | TC-DASH |
| FR-143 | Language distribution.                                                                                                                                           | P1   | US-102         | TC-DASH |
| FR-144 | Topic × sentiment matrix and negative-topic contributors.                                                                                                        | P1   | US-103         | TC-DASH |
| FR-145 | Keyword (query) share of mentions (per-query counts may overlap).                                                                                                | P1   | US-158         | TC-DASH |
| FR-146 | Daily/hourly aggregate tables refreshed incrementally when volume requires.                                                                                      | P1.5 | US-159         | TC-DASH |
| FR-147 | Project-wide totals SHALL use `COUNT(DISTINCT post_id)`; per-query breakdowns may count a post under each query.                                                 | P0   | US-092         | TC-DASH |

## FR-15x/16x · Mentions

| ID     | Requirement                                                                                                                                                     | Pri | Stories | Verify |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- | ------ |
| FR-150 | `GET …/mentions` SHALL return cursor-paginated items (default 25, max 100) with fields per API contract.                                                        | P0  | US-110  | TC-MEN |
| FR-151 | List rows SHALL show platform, username, time (tz), preview, matched queries, sentiment/safety badges, top intents/topics, language, confidence, external link. | P0  | US-110  | TC-MEN |
| FR-152 | Filters: `from,to,queryIds[],q,relevance[],sentiment[],safety[],intent[],topic[],language[],analysisStatus[],reviewStatus[]`.                                   | P0  | US-111  | TC-MEN |
| FR-153 | Sort: `newest` (default), `oldest`, `safety_desc`, `confidence_asc`, `relevance_desc`.                                                                          | P0  | US-112  | TC-MEN |
| FR-154 | `GET …/mentions/:id` SHALL return source, matches, current analysis (with category scores & versions), run history summary, overrides (P1).                     | P0  | US-113  | TC-MEN |
| FR-155 | Detail SHALL provide actions: re-analyze (role-gated), copy id, open on Threads, override (P1).                                                                 | P0  | US-113  | TC-MEN |
| FR-156 | Analysis status badges SHALL show pending/processing/failed/stale; failed shows error code.                                                                     | P0  | US-114  | TC-MEN |
| FR-157 | External links SHALL use `target=_blank rel="noopener noreferrer"`.                                                                                             | P0  | US-115  | TC-MEN |
| FR-158 | Post text SHALL be rendered as plain text; no HTML injection.                                                                                                   | P0  | US-116  | TC-MEN |
| FR-159 | Empty state SHALL distinguish no-data vs sync-failed vs analysis-pending.                                                                                       | P0  | US-117  | TC-MEN |
| FR-160 | Deep link `/mentions/:id` SHALL work directly (SSR/CSR) with auth.                                                                                              | P0  | US-121  | TC-MEN |
| FR-161 | Text search `q` SHALL use Postgres FTS (`tsvector` GIN) with ILIKE fallback for short terms.                                                                    | P0  | US-111  | TC-MEN |

## FR-17x · System Status & Observability

| ID     | Requirement                                                                                                | Pri | Stories | Verify |
| ------ | ---------------------------------------------------------------------------------------------------------- | --- | ------- | ------ |
| FR-170 | System Status page SHALL show Threads, collector, analyzer, database sections and auto-refresh every 30 s. | P0  | US-130  | TC-SYS |
| FR-171 | `GET …/system-status` per API contract.                                                                    | P0  | US-131  | TC-SYS |
| FR-172 | `GET /health/live` (process) and `GET /health/ready` (DB required; providers informational).               | P0  | US-132  | TC-SYS |
| FR-173 | Logs SHALL be structured JSON with correlation fields; secrets redacted by key pattern.                    | P0  | US-133  | TC-SYS |
| FR-174 | Metrics per observability doc exposed at `/metrics` (protected) or periodic log lines.                     | P0  | US-134  | TC-SYS |
| FR-175 | Admin SHALL retry failed analysis runs / sync jobs from System Status.                                     | P0  | US-135  | TC-SYS |
| FR-176 | Collection lag and analysis lag SHALL be computed per definitions.                                         | P0  | US-136  | TC-SYS |

## FR-18x · Export (P1)

| ID     | Requirement                                                                                            | Pri | Stories | Verify |
| ------ | ------------------------------------------------------------------------------------------------------ | --- | ------- | ------ |
| FR-180 | `GET …/mentions/export.csv` SHALL accept list filters and stream CSV (UTF-8 BOM) with defined columns. | P1  | US-170  | TC-EXP |
| FR-181 | Export SHALL cap at `EXPORT_MAX_ROWS` and return `413 EXPORT_TOO_LARGE` with the cap when exceeded.    | P1  | US-170  | TC-EXP |
| FR-182 | Async export jobs (`POST /exports`, `GET /exports/:id`).                                               | P2  | US-172  | TC-EXP |

## FR-19x · Analyst Workflow (P1)

| ID     | Requirement                                                                                                        | Pri | Stories        | Verify          |
| ------ | ------------------------------------------------------------------------------------------------------------------ | --- | -------------- | --------------- |
| FR-190 | Admin SHALL edit confidence bands and safety policy thresholds; changes create a new policy version.               | P1  | US-142, US-160 | TC-REV          |
| FR-191 | Analyst/Admin SHALL create an override for `relevance, sentiment, safety_level, intents, topics` with reason.      | P1  | US-150         | TC-REV          |
| FR-192 | Effective value SHALL be `active override > latest completed AI analysis` and used by analytics & lists.           | P1  | US-150         | TC-REV, TC-DASH |
| FR-193 | Overrides SHALL be revocable with history retained (`revoked_at`).                                                 | P1  | US-151         | TC-REV          |
| FR-194 | UI SHALL distinguish AI vs Analyst values with explicit badges/tooltips.                                           | P1  | US-152         | TC-REV          |
| FR-195 | Review queue SHALL list `uncertain`, low-confidence (< band) and failed runs; items can be marked reviewed.        | P1  | US-153         | TC-REV          |
| FR-196 | Bulk re-analysis SHALL preview count, enforce `ANALYSIS_BULK_MAX`, rate limit (1 per 5 min per project) and audit. | P1  | US-154         | TC-REV          |

## FR-20x · Audit

| ID     | Requirement                                                                                                                                                                                                            | Pri | Stories | Verify |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- | ------ |
| FR-200 | The system SHALL write `audit_logs` for: integration changes, query create/update/delete/restore/run/backfill, project/member changes, re-analysis, override, export, threshold changes. Metadata contains no secrets. | P0  | many    | TC-SYS |
| FR-201 | Admin SHALL view audit logs with filters.                                                                                                                                                                              | P0  | US-137  | TC-SYS |

---

## Traceability matrix (FR → Story → Test-case file → Epic)

| FR range               | Stories    | Test file                                                           | Epic |
| ---------------------- | ---------- | ------------------------------------------------------------------- | ---- |
| FR-010…019             | US-001…008 | [TC-AUTH](../04-qa/test-cases/TC-AUTH-authentication-rbac.md)       | E01  |
| FR-030…036             | US-010…014 | [TC-PROJ](../04-qa/test-cases/TC-PROJ-project-members.md)           | E02  |
| FR-040…048             | US-020…026 | [TC-INT](../04-qa/test-cases/TC-INT-threads-integration.md)         | E03  |
| FR-050…063             | US-030…041 | [TC-LQ](../04-qa/test-cases/TC-LQ-listening-queries.md)             | E04  |
| FR-070…089             | US-050…063 | [TC-COL](../04-qa/test-cases/TC-COL-collector-sync.md)              | E05  |
| FR-100…119             | US-070…084 | [TC-ANA](../04-qa/test-cases/TC-ANA-analysis-pipeline.md)           | E06  |
| FR-130…147             | US-090…103 | [TC-DASH](../04-qa/test-cases/TC-DASH-overview-dashboard.md)        | E07  |
| FR-150…161             | US-110…121 | [TC-MEN](../04-qa/test-cases/TC-MEN-mentions-explorer.md)           | E08  |
| FR-170…176, FR-200…201 | US-130…137 | [TC-SYS](../04-qa/test-cases/TC-SYS-system-status-observability.md) | E09  |
| FR-180…182             | US-170…172 | [TC-EXP](../04-qa/test-cases/TC-EXP-export.md)                      | E12  |
| FR-190…196             | US-150…160 | [TC-REV](../04-qa/test-cases/TC-REV-analyst-workflow.md)            | E11  |

Task-level traceability (FR → `T-###` → GitHub issue) is maintained in [../03-delivery/02-work-breakdown.md](../03-delivery/02-work-breakdown.md) and [../03-delivery/backlog.json](../03-delivery/backlog.json).
