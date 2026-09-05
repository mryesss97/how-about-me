# 03 · Epics & User Stories

| Field        | Value                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status       | Approved (baseline v1.0)                                                                                                                                                                                     |
| Source       | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §4–§18, §21                                                                                                                  |
| Traceability | Each story lists the `FR-` ids it realises; FRs map to test cases in [../04-qa/test-cases/](../04-qa/test-cases/) and to tasks in [../03-delivery/02-work-breakdown.md](../03-delivery/02-work-breakdown.md) |

Story format: **As a** ‹role› **I want** ‹capability› **so that** ‹value›. Acceptance criteria use Given/When/Then. Priority P0 = MVP.

Roles: **Admin**, **Analyst**, **Viewer**, **Any user** (all three), **Engineer** (technical enabler), **System** (automated behaviour).

---

## Epic map

| Epic | Name                                                               | Priority | Milestone | Stories       |
| ---- | ------------------------------------------------------------------ | -------- | --------- | ------------- |
| E01  | Authentication & RBAC                                              | P0       | M2        | US-001…US-008 |
| E02  | Monitoring Project & Members                                       | P0       | M2        | US-010…US-014 |
| E03  | Threads Integration                                                | P0       | M1/M2     | US-020…US-026 |
| E04  | Listening Queries                                                  | P0       | M2        | US-030…US-041 |
| E05  | Collector & Sync Jobs                                              | P0       | M2        | US-050…US-063 |
| E06  | Content Intelligence (Analysis)                                    | P0       | M3        | US-070…US-084 |
| E07  | Overview Dashboard                                                 | P0       | M4        | US-090…US-103 |
| E08  | Mentions Explorer & Detail                                         | P0       | M4        | US-110…US-121 |
| E09  | System Status & Observability                                      | P0       | M2/M4     | US-130…US-137 |
| E10  | Settings                                                           | P0       | M4        | US-140…US-143 |
| E11  | Analyst Workflow (review, override, bulk re-analysis, backfill UI) | P1       | M6        | US-150…US-160 |
| E12  | Export                                                             | P1       | M6        | US-170…US-172 |
| E13  | Engineering Foundation & Delivery (technical enablers)             | P0       | M0/M5     | US-180…US-190 |

---

## E01 · Authentication & RBAC

### US-001 Sign in with email (P0)

As **any user** I want to sign in with my work email so that only invited teammates can access the tool.

- Given an invited user with valid credentials, when they submit the login form, then they land on `/overview` within 3 s and `GET /me` returns their profile and project roles.
- Given a non-invited email, when they try to sign in, then Supabase rejects and the UI shows "Account not found. Ask an admin to invite you." — no sign-up link is shown.
- Given an expired session, when any API call returns `401`, then the FE refreshes the token once and, if refresh fails, redirects to `/login?reason=expired`.
- Realises: FR-010, FR-011, FR-013.

### US-002 Optional Google sign-in (P1, org decision)

As **any user** I want to sign in with the organisation Google account so that I don't manage another password.

- Given Google provider is enabled in Supabase and the email domain is allow-listed, when the user completes OAuth, then a `user_profiles` row exists and the roles come from `project_members`.
- Realises: FR-012.

### US-003 Server-side role enforcement (P0)

As the **system** I must enforce roles on every write endpoint so that hiding a button is never the only protection.

- Given a Viewer JWT, when calling `POST /projects/:id/listening-queries`, then the response is `403 FORBIDDEN_ROLE` and nothing is written.
- Given an Analyst JWT, when calling `PATCH /projects/:id` , then `403`.
- Given a user who is not a member of the project, when calling any `/projects/:id/*` endpoint, then `403 FORBIDDEN_PROJECT`.
- Given a request without a token or with a tampered signature, then `401 AUTH_INVALID_TOKEN`.
- Realises: FR-014, FR-015, FR-016.

### US-004 Profile bootstrap on first login (P0)

As the **system** I create a `user_profiles` row on first authenticated request so that membership and audit can reference the user.

- Given a valid JWT whose `sub` has no profile, when any endpoint is called, then a profile is upserted with `email`, `display_name` from claims.
- Realises: FR-017.

### US-005 Role-aware navigation (P0)

As **any user** I want the sidebar and actions to reflect my role so that I'm not shown controls I can't use.

- Given a Viewer, when the app loads, then Settings → Integrations and the query create/edit/delete/run actions are hidden; Overview/Mentions/System Status are visible.
- Given an Admin, then all navigation items are visible.
- Realises: FR-018.

### US-006 Seed first admin (P0)

As an **Engineer** I want the first Admin to be seeded from configuration so that a fresh environment is usable without manual DB edits.

- Given `SEED_ADMIN_EMAIL` is set, when `pnpm db:seed` runs, then that user (created in Supabase Auth if absent, when service key is present) is an `admin` member of the seed project.
- Realises: FR-019.

### US-007 Sign out (P0)

As **any user** I want to sign out so that a shared machine is safe.

- When the user clicks Sign out, then the Supabase session is cleared, TanStack Query cache is reset, and the user is redirected to `/login`.
- Realises: FR-011.

### US-008 Access-denied UX (P0)

As **any user** I want a clear message when I open a page or action I'm not allowed to so that I know to ask an admin.

- Given a Viewer deep-links to `/settings/integrations`, then the page shows a "You don't have permission" state with a link back to Overview (no crash, no blank page).
- Realises: FR-018.

---

## E02 · Monitoring Project & Members

### US-010 Seeded monitoring project (P0)

As an **Admin** I want the project `1Zone / Eventista Social Listening` (timezone `Asia/Ho_Chi_Minh`, platform Threads) to exist after deployment so that the team can start immediately.

- Given a fresh DB, when migrations + seed run, then exactly one `monitoring_projects` row with slug `1zone-eventista` exists and is active.
- Realises: FR-030.

### US-011 View project (P0)

As **any user** I want to see the project name and timezone so that I know which scope I'm looking at.

- `GET /projects` returns only projects where I'm a member with my role; `GET /projects/:id` returns settings.
- Realises: FR-031.

### US-012 Edit project name/timezone (P0)

As an **Admin** I want to edit the project name and timezone so that analytics buckets follow our local day.

- Given a valid IANA timezone, when saved, then subsequent analytics default to it and an audit row `project.updated` is written. Invalid timezone → `400 VALIDATION_ERROR`.
- Realises: FR-032, FR-200.

### US-013 Manage members & roles (P0)

As an **Admin** I want to invite a teammate by email and set their role so that access is controlled.

- Given an email, when I add a member with role `analyst`, then a `project_members` row exists (profile created lazily on first login) and an audit row `member.added` is written.
- Changing a role updates immediately (next request uses new role). Removing a member revokes access (`403` on next request).
- An Admin cannot remove or downgrade the last remaining Admin (`409 LAST_ADMIN`).
- Realises: FR-033, FR-034, FR-035.

### US-014 Project switcher hidden for single project (P0)

As **any user** I don't want to see a project switcher when only one project exists so that the UI stays simple.

- Given `/me` returns one project, then no switcher is rendered; with ≥ 2 projects, a switcher appears in the sidebar header.
- Realises: FR-036.

---

## E03 · Threads Integration

### US-020 Configure Threads connection securely (P0)

As an **Admin** I want to store the Threads access token server-side so that the collector can call the API and the token never reaches the browser.

- Given a token pasted in Settings → Integrations, when saved, then it is encrypted at rest (AES-256-GCM with `INTEGRATION_ENCRYPTION_KEY`), `integration_connections` stores only metadata (`status`, `account_identifier`, `granted_scopes`, `token_expires_at`), and the API never returns the token in any response or log.
- Realises: FR-040, FR-041, FR-043.

### US-021 Verify connection (P0)

As an **Admin** I want to click "Verify" so that I know the token works before the scheduler relies on it.

- When verifying, the BE performs a lightweight provider call (e.g. `GET /me` or a `limit=1` search) and updates `last_verified_at`, `status` (`connected|expired|permission_error|error`), `last_error_code/message`.
- Realises: FR-042.

### US-022 See connection status without secrets (P0)

As **any user** I want to see whether Threads is connected and when it last succeeded so that I can judge data completeness.

- Integration status card shows status badge, account identifier, scopes, token expiry (date only), last success, last error. Token value is never rendered.
- Realises: FR-044.

### US-023 Token expiry / revocation handling (P0)

As the **system** I must detect 401/403 from Threads and flip integration status so that admins are alerted.

- Given a `401` from the provider, when a sync runs, then the job fails with `THREADS_UNAUTHORIZED`, `integration_connections.status = expired`, the scheduler pauses that project's queries until re-verified, and System Status shows "Threads connection needs attention".
- Realises: FR-045, FR-085.

### US-024 Token refresh (P0 if supported by Meta long-lived token flow)

As the **system** I attempt token refresh before expiry so that ingestion is not interrupted.

- Given `token_expires_at` is within 7 days and refresh is supported, then a daily job refreshes and stores the new token; failures set status `expired` and audit `integration.refresh_failed`.
- Realises: FR-046.

### US-025 Provider adapter isolation (P0, Engineer)

As an **Engineer** I want all Threads API specifics behind `SocialDiscoveryProvider` so that API changes don't leak into the domain.

- No module other than `ThreadsModule` imports provider DTOs; contract tests run against recorded fixtures.
- Realises: FR-047.

### US-026 Threads API POC report (P0, M1)

As the **Product Owner** I want a written POC report so that ingestion requirements are frozen on verified facts.

- Report follows the template in [../05-operations/01-poc-threads-api.md](../05-operations/01-poc-threads-api.md) and all exit criteria are ticked or explicitly waived.
- Realises: FR-048.

---

## E04 · Listening Queries

### US-030 Seed default queries (P0)

As an **Admin** I want `1zone` (KEYWORD), `1zone` (TAG), `eventista` (KEYWORD), `eventista` (TAG) seeded and enabled so that listening starts immediately.

- Seed is idempotent (re-running does not duplicate). `#` is not persisted in `query_value`.
- Realises: FR-050.

### US-031 List queries (P0)

As **any user** I want a table of queries with type, enabled, poll interval, last sync, last result count, last status, created by so that I understand what is being monitored.

- Table columns per [09-ux-specification.md](09-ux-specification.md#listening-queries). Soft-deleted queries hidden by default, toggle "Show deleted".
- Realises: FR-051.

### US-032 Create query (P0)

As an **Admin** I want to add a keyword or topic tag without deployment so that new campaigns are monitored the same day.

- Form: display name, query value, type (keyword/topic_tag), exclude terms, poll interval (60–86400 s), overlap (0–86400 s), initial backfill range (0–30 days, P1 executes it), enabled.
- Duplicate `(project, platform, type, lower(value))` among non-deleted → `409 QUERY_DUPLICATE`.
- On create with `enabled=true`, `next_run_at = now()` so the scheduler picks it up within 1 minute.
- Audit `query.created`.
- Realises: FR-052, FR-053, FR-056, FR-200.

### US-033 Edit query (P0)

As an **Admin** I want to edit exclude terms, interval, overlap, display name, enabled so that I can tune noise and cost.

- `query_value` and `query_type` are immutable after creation (create a new query instead) — enforced with `400 QUERY_IMMUTABLE_FIELD`.
- Audit `query.updated` with diff (no secrets).
- Realises: FR-054.

### US-034 Enable / disable query (P0)

As an **Admin** I want to pause a query so that noisy or finished campaigns stop consuming quota.

- Disabled queries are skipped by the scheduler; existing posts remain; re-enabling sets `next_run_at = now()`.
- Realises: FR-055.

### US-035 Soft delete & restore (P0)

As an **Admin** I want to delete a query without losing history so that past analytics still work.

- Delete sets `deleted_at`; matches and posts are kept; query disappears from default lists and filters (still shown in historical drill-down as "(deleted)"). Restore clears `deleted_at`.
- Realises: FR-057.

### US-036 Run now (P0)

As an **Admin** I want to trigger a sync immediately so that I can validate a new query.

- `POST …/run` enqueues a `sync_jobs` row (`queued`), returns `{jobId, status}`, UI shows toast with link to job. If a job for the same query is already `running`, return `409 SYNC_ALREADY_RUNNING`.
- Realises: FR-058.

### US-037 Exclude terms applied post-ingestion (P0)

As an **Admin** I want exclude terms like "time zone" to filter noise so that false positives don't pollute metrics.

- Given exclude terms, when a fetched post text contains any term (case-insensitive, Unicode-normalised), then the post is stored but the `post_query_matches` row is flagged `excluded_by_terms = true` and it is not counted for that query; if excluded by all matched queries it is not queued for analysis.
- Realises: FR-059.

### US-038 Include terms (P0, optional field)

As an **Admin** I want optional include terms so that a broad query only counts posts containing at least one of them.

- Same matching rules as exclude; empty list = no constraint.
- Realises: FR-060.

### US-039 Per-query sync visibility (P0)

As **any user** I want to see last successful sync, last error and posts discovered per query so that I trust the data.

- Table shows `last_successful_sync_at`, `last_error_at/message` (truncated), count of distinct posts matched (all-time and last 24 h).
- Realises: FR-061.

### US-040 View mentions for a query (P0)

As **any user** I want "View mentions" from the query row so that I can inspect its results.

- Navigates to `/mentions?queryIds=<id>`.
- Realises: FR-062.

### US-041 Backfill request (P1, UI M6; API M2 minimal)

As an **Admin** I want to backfill a historical window so that a newly added term has history.

- `POST …/backfill {since, until}`: validates `until > since`, window ≤ provider max (config), creates a `sync_jobs` row with `search_type` per body (`RECENT` default), runs paginated until exhausted; UI shows progress.
- Realises: FR-063.

---

## E05 · Collector & Sync Jobs

### US-050 Scheduled polling (P0)

As the **system** I poll each enabled query on its interval so that new posts are discovered within ~interval + provider lag.

- A scheduler tick every 60 s selects queries with `enabled AND deleted_at IS NULL AND next_run_at <= now()` and claims them atomically (see US-062).
- After a run, `next_run_at = completed_at + poll_interval_seconds` regardless of success (failures use backoff, US-060).
- Realises: FR-070, FR-071.

### US-051 Search window computation (P0)

As the **system** I compute `since = last_successful_sync_at - overlap` and `until = now()` so that late-indexed posts are not missed.

- First run without history uses `since = now() - initial_backfill_range` (default 24 h). Window is clamped to provider-supported maximum. Unit-tested edge cases: no history, overlap > interval, clock skew.
- Realises: FR-072.

### US-052 Pagination (P0)

As the **system** I follow cursor pagination until exhausted or page cap so that windows are fully collected.

- Page cap `COLLECTOR_MAX_PAGES_PER_JOB` (default 50). Hitting the cap → job `partial` with `last_cursor` stored for resume.
- Realises: FR-073.

### US-053 Normalisation & validation (P0)

As the **system** I map provider items to a provider-neutral `NormalizedPost` so that the domain never sees raw shapes.

- Required: `platform_post_id`, `published_at`; missing → counted `records_invalid`, logged with item id, not stored.
- Text normalised (NFC, trimmed); `content_hash = sha256(normalised text + media_type + link_attachment_url)`.
- Realises: FR-074, FR-075.

### US-054 Idempotent upsert & deduplication (P0)

As the **system** I upsert by `(platform, platform_post_id)` so that the same post found by many queries or many polls is stored once.

- Unchanged post: only `last_seen_at` updated, `records_duplicated++`.
- New post: inserted, `first_seen_at = last_seen_at = now()`, `records_inserted++`, analysis queued.
- Match row upserted `(post_id, query_id)` with `last_matched_at` updated.
- Realises: FR-076, FR-077.

### US-055 Content change detection (P0)

As the **system** I detect text changes so that analysis stays accurate.

- If `content_hash` differs: update text/normalised fields, `revision++`, mark current analysis `stale`, queue new analysis, `records_updated++`.
- Realises: FR-078.

### US-056 Raw snapshot retention (P0)

As an **Engineer** I keep a controlled JSONB snapshot of requested provider fields so that I can debug and re-process.

- Only requested fields are stored; no extra profile enrichment; size guard 32 KB (truncate with flag).
- Realises: FR-079.

### US-057 Sync job record & metrics (P0)

As **any user** I want each run recorded with counts so that "0 new posts" is distinguishable from "failed".

- `sync_jobs` stores status, window, pages, fetched, inserted, updated, duplicated, invalid, provider requests, rate-limit events, last cursor, error code/message, timings.
- Realises: FR-080.

### US-058 Sync jobs list & detail (P0)

As **any user** I want to browse sync jobs filtered by query/status/date so that I can audit ingestion.

- `GET /sync-jobs` (cursor, filters) and `GET /sync-jobs/:id`; UI in System Status → Sync jobs tab.
- Realises: FR-081.

### US-059 Provider error mapping (P0)

As the **system** I map provider errors to stable codes so that UI and alerts are consistent.

- `401→THREADS_UNAUTHORIZED`, `403→THREADS_FORBIDDEN`, `429→THREADS_RATE_LIMITED`, `5xx→THREADS_UPSTREAM_ERROR`, timeout→`THREADS_TIMEOUT`, malformed→`THREADS_MALFORMED_RESPONSE`.
- Realises: FR-082.

### US-060 Retry with backoff & jitter (P0)

As the **system** I retry transient failures so that temporary issues don't lose data.

- 429/5xx/timeout: up to `COLLECTOR_MAX_RETRIES` (3) with exponential backoff (base 2 s, cap 60 s, full jitter). 400/401/403: no blind retry. `Retry-After` header respected when present.
- Job-level failure backoff: `next_run_at = now() + min(interval × 2^failures, 1 h)`.
- Realises: FR-083.

### US-061 Circuit breaker / pause (P0)

As the **system** I pause the collector after repeated provider failures so that I don't hammer a broken integration.

- After `COLLECTOR_CIRCUIT_FAILURE_THRESHOLD` (5) consecutive provider failures across jobs, open the circuit for `COLLECTOR_CIRCUIT_OPEN_SECONDS` (600); System Status shows `collector.status = paused` with reason.
- Realises: FR-084.

### US-062 Safe multi-instance execution (P0)

As an **Engineer** I want DB-level job claiming so that two API/worker instances never run the same query concurrently.

- Claim via `UPDATE … SET locked_at, locked_by WHERE id=? AND (locked_at IS NULL OR locked_at < now() - stale_interval) RETURNING` (or advisory lock). Stale lock threshold configurable (default 15 min).
- Realises: FR-086.

### US-063 Partial success (P0)

As the **system** I record `partial` when some pages succeeded and a later page failed so that data collected is kept and the window can resume.

- Inserted rows are committed per page; job stores `last_cursor`; next run's window still overlaps.
- Realises: FR-087.

---

## E06 · Content Intelligence (Analysis)

### US-070 Analysis queue & state machine (P0)

As the **system** I process posts through `pending → processing → completed | failed | skipped | stale` so that status is always known.

- An `analysis_runs` row is created when a post is queued; worker claims `pending` rows in batches (`ANALYSIS_BATCH_SIZE` 20) with DB claiming; stuck `processing` older than 10 min are re-queued.
- Realises: FR-100, FR-101.

### US-071 Relevance classification (3-state) (P0)

As an **Analyst** I want each post labelled `relevant | uncertain | irrelevant` with confidence and a short explanation so that noise is excluded from metrics.

- Explanation ≤ 200 chars, user-facing, no chain-of-thought.
- Realises: FR-102.

### US-072 Relevance gate for cost (P0)

As the **system** I skip the expensive classifier steps for `irrelevant` posts so that cost stays low.

- Irrelevant posts get `status=completed` with only relevance (+ language if computed); intents/topics/summary empty; `skipped_reason = irrelevant`.
- Realises: FR-103.

### US-073 Safety moderation (P0)

As an **Analyst** I want provider safety categories & scores stored and mapped to `safe | sensitive | severe` so that risky discussions are visible.

- Provider: OpenAI `omni-moderation-latest` behind `SafetyProvider`. Store `safety_flagged`, `safety_category_scores` JSONB, `safety_level`, `safety_policy_version`.
- Policy v1 thresholds in [08-taxonomy-classification.md](08-taxonomy-classification.md#safety-policy-v1).
- Realises: FR-104, FR-105.

### US-074 Structured classification (P0)

As an **Analyst** I want sentiment, intents[], topics[], language, summary produced in one structured call so that results are consistent and cheap.

- Output validated against the JSON schema in [../02-architecture/07-analysis-pipeline.md](../02-architecture/07-analysis-pipeline.md#json-schema); unknown labels → one corrective retry, then `failed` with `ANALYSIS_SCHEMA_INVALID`.
- Realises: FR-106, FR-107, FR-108, FR-109, FR-110.

### US-075 Language detection (P0)

As an **Analyst** I want the language (`vi, en, ko, ja, th, zh, other, unknown`; ISO 639-1) so that I can filter by audience.

- Realises: FR-109.

### US-076 Summary for relevant content only (P0)

As an **Analyst** I want a one-sentence summary so that I scan faster.

- Not generated for empty text, irrelevant, or spam when `ANALYSIS_SKIP_SUMMARY_FOR_SPAM=true`.
- Realises: FR-110.

### US-077 Versioned results (P0)

As an **Admin** I want every result stamped with `classifier_provider/model`, `prompt_version`, `taxonomy_version`, `safety_provider/model`, `safety_policy_version`, `analyzed_at` so that changes are auditable.

- Realises: FR-111.

### US-078 Provider abstraction & configurability (P0)

As an **Engineer** I want `SafetyProvider` and `ContentClassifier` interfaces with the model chosen by env so that we can switch models without touching the domain.

- `ANALYSIS_CLASSIFIER_PROVIDER=openai`, `ANALYSIS_CLASSIFIER_MODEL=<configurable>`; a `FakeClassifier` exists for tests/local.
- Realises: FR-112.

### US-079 Retry & dead-letter (P0)

As the **system** I retry transient provider errors and mark permanent failures so that the queue never blocks.

- Max attempts 3 with backoff; then `failed` with error code; `failed` runs visible in System Status and re-triable by Admin.
- Realises: FR-113.

### US-080 Effective analysis pointer (P0)

As the **system** I maintain `social_posts.current_analysis_id` (latest completed run) so that dashboards join one row per post.

- Updated in the same transaction as the run completion; a DB view `effective_post_analysis` overlays overrides (P1).
- Realises: FR-114.

### US-081 Re-analyze a single mention (P0)

As an **Admin** (Analyst when allowed) I want to re-run analysis on a post so that misclassifications are fixed after prompt updates.

- Creates a new run with current versions; previous runs preserved; audit `analysis.reanalyze_requested`.
- Realises: FR-115, FR-200.

### US-082 Never re-analyze identical content+version (P0)

As the **system** I skip runs whose `(source_content_hash, effective_version)` already completed so that cost is never wasted (unless forced).

- `force=true` bypasses for manual re-analysis.
- Realises: FR-116.

### US-083 Cost & token tracking (P0)

As an **Admin** I want tokens and estimated USD per run so that I can watch AI spend.

- `input_tokens`, `output_tokens`, `estimated_cost_usd` stored; System Status shows 24 h totals.
- Realises: FR-117.

### US-084 Evaluation dataset & baseline (P0, M3 gate)

As the **Product Owner** I want prompt/taxonomy v1 evaluated on a labelled Vietnamese/English set so that quality is known before freezing.

- ≥ 150 labelled samples per [../04-qa/03-ai-evaluation-plan.md](../04-qa/03-ai-evaluation-plan.md); accuracy reported per dimension; v1 frozen only if thresholds met or waived.
- Realises: FR-118.

---

## E07 · Overview Dashboard

### US-090 Global filters (P0)

As **any user** I want filters (time range, timezone, query, sentiment, safety, intent, topic, language, relevance, analysis status) so that every chart answers my question.

- Filters are URL-synced (shareable links), persisted per session, and apply to all cards/charts simultaneously.
- Realises: FR-130.

### US-091 Time presets & custom range (P0)

Presets: Last 1 h, 24 h, 7 d, 30 d, Custom. Default 7 d. Custom range max 366 days. Timezone selector defaults to project timezone.

- Realises: FR-131.

### US-092 KPI cards (P0)

Total Relevant Mentions, Growth vs previous period, Positive Rate, Negative Rate, Sensitive+Severe Rate, Complaint Rate — each with tooltip showing definition & denominator per [07-metric-definitions.md](07-metric-definitions.md).

- Growth shows `New` when previous = 0.
- Realises: FR-132, FR-133.

### US-093 Coverage banner (P0)

As **any user** I want to see analysed / pending / failed counts for the range so that I don't misread incomplete data.

- Banner states: "124 mentions are waiting for analysis", "Latest Threads sync failed. Data may be incomplete", "Threads connection needs attention".
- Realises: FR-134.

### US-094 Mentions over time (P0)

Line/bar by hour (≤ 48 h) or day (> 48 h) in selected timezone; previous period as ghost series when compare on.

- Realises: FR-135.

### US-095 Sentiment distribution (P0) · US-096 Sentiment over time (P0) · US-097 Safety distribution (P0) · US-098 Top topics (P0) · US-099 Intent distribution (P0)

Charts per [09-ux-specification.md](09-ux-specification.md#overview). Colours never the only encoding (labels/icons/patterns). Denominators shown in tooltips.

- Realises: FR-136…FR-140.

### US-100 Previous-period comparison (P0)

Toggle "Compare with previous period" computes an equal-length window immediately preceding, aligned to timezone boundaries.

- Realises: FR-141.

### US-101 Drill-down to mentions (P0)

Clicking any KPI or chart segment opens `/mentions` with equivalent filters (e.g. `sentiment=negative&topic=ticket&from&to`). Counts reconcile exactly.

- Realises: FR-142.

### US-102 Language distribution (P1) · US-103 Topic × sentiment & negative-topic contributors (P1)

- Realises: FR-143, FR-144.

---

## E08 · Mentions Explorer & Detail

### US-110 Mentions list (P0)

Rows show platform icon, username, publish time (tz), text preview (2 lines), matched queries, sentiment/safety badges, top intents/topics, language, confidence indicator, external link. Cursor pagination 25/page, "Load more".

- Realises: FR-150, FR-151.

### US-111 Filters (P0)

Date, query, text search (`q`, Postgres FTS/ILIKE), sentiment, safety, intent, topic, language, relevance, analysis status, reviewed/unreviewed (P1).

- Realises: FR-152.

### US-112 Sorting (P0)

Newest (default), oldest, highest safety severity, lowest confidence, highest relevance score.

- Realises: FR-153.

### US-113 Mention detail (P0)

Original (full text, username, timestamp, permalink, media metadata/thumbnail URL, matched queries, first/last seen, revision) · Analysis (all dimensions, category scores, summary, model confidence, versions, analyzed_at) · Operations (re-analyze, override P1, copy post id, open on Threads).

- Realises: FR-154, FR-155.

### US-114 Analysis status states in list/detail (P0)

Pending/processing/failed/stale badges; failed shows error code with tooltip; Admin can retry.

- Realises: FR-156.

### US-115 Open on Threads (P0)

External link with `rel="noopener noreferrer" target="_blank"`, icon indicates external.

- Realises: FR-157.

### US-116 Safe rendering (P0)

Post text rendered as text (no HTML), links auto-detected but not followed as HTML; media shown as URL/thumbnail only if allowed.

- Realises: FR-158.

### US-117 Empty / loading / error states (P0)

Skeletons while loading; empty state text differentiates "no mentions" vs "sync failed" vs "analysis pending".

- Realises: FR-159.

### US-118 Copy post id / permalink (P0) · US-119 Keyboard navigation in list (P0) · US-120 Responsive layout (P0) · US-121 Deep-link to detail `/mentions/:id` (P0)

- Realises: FR-160, NFR-030…

---

## E09 · System Status & Observability

### US-130 System status page (P0)

Threads connection, collector (active queries, last global sync, jobs in progress, failed 24 h, lag), analyzer (pending, failed 24 h, lag, versions, 24 h cost), database (approx mention count).

- Auto-refresh every 30 s.
- Realises: FR-170.

### US-131 System status API (P0) — `GET …/system-status` per contract. Realises: FR-171.

### US-132 Health endpoints (P0) — `GET /health/live`, `GET /health/ready` (DB required; AI providers reported but non-blocking). Realises: FR-172.

### US-133 Structured logs (P0) — pino JSON with `request_id, job_id, query_id, project_id, provider, status, duration_ms, result_count, error_code`; secrets redacted. Realises: FR-173.

### US-134 Metrics (P0) — counters/gauges per [../02-architecture/09-observability.md](../02-architecture/09-observability.md) exposed at `/metrics` (Prometheus text) or logged periodically. Realises: FR-174.

### US-135 Failed jobs list & retry (P0) — Admin can retry a failed analysis run / sync job from System Status. Realises: FR-175.

### US-136 Collection & analysis lag (P0) — `collection_lag_seconds = now - max(last_successful_sync_at)`; `analysis_lag_seconds = now - min(created_at of pending)`. Realises: FR-176.

### US-137 Audit log viewer (P0, Admin) — table of `audit_logs` with actor, action, entity, time; filter by action/date. Realises: FR-201.

---

## E10 · Settings

### US-140 Settings shell (P0) — `/settings` with tabs: Project, Members, Integrations, Analysis (P1). Realises: FR-032…

### US-141 Integrations tab (P0) — Threads card (US-020…US-022). Realises: FR-040…

### US-142 Analysis settings (P1) — thresholds for confidence bands & safety policy, versioned; changing policy version prompts optional re-analysis. Realises: FR-190.

### US-143 Project settings toggles (P0) — `allowAnalystReanalyze`, `allowViewerExport`. Realises: FR-032.

---

## E11 · Analyst Workflow (P1, M6)

### US-150 Manual override (P1) — Analyst overrides relevance/sentiment/safety/intent/topic with reason; original kept; effective value = override. Realises: FR-191, FR-192.

### US-151 Revoke override (P1) — keeps history (`revoked_at`). Realises: FR-193.

### US-152 Override visibly distinct (P1) — "Analyst" badge vs "AI" badge everywhere. Realises: FR-194.

### US-153 Review queue (P1) — `/reviews` lists `uncertain` + low-confidence + failed; mark reviewed. Realises: FR-195.

### US-154 Bulk re-analysis (P1) — by filter with preview count, hard cap (`ANALYSIS_BULK_MAX` 2 000), rate limited. Realises: FR-196.

### US-155 Backfill UI (P1) — form + job progress (US-041). Realises: FR-063.

### US-156 Topic × sentiment matrix (P1) · US-157 Negative-topic contributors (P1) · US-158 Keyword share of mentions (P1) · US-159 Daily aggregates (P1.5) · US-160 Configurable thresholds (P1)

- Realises: FR-143, FR-144, FR-145, FR-146, FR-190.

---

## E12 · Export (P1, M6)

### US-170 CSV export of filtered mentions (P1) — same filters as list; columns per source §15; synchronous cap `EXPORT_MAX_ROWS` 10 000 with clear error; Viewer allowed only if setting enabled. Realises: FR-180, FR-181.

### US-171 Export audit (P1) — audit `mentions.exported` with filter & row count. Realises: FR-200.

### US-172 Async export jobs (P2) — `POST /exports`, `GET /exports/:id`. Realises: FR-182.

---

## E13 · Engineering Foundation & Delivery (technical enablers)

### US-180 Monorepo & tooling (P0) — pnpm + Turborepo, `apps/web`, `apps/api`, `packages/*`, lint/format/typecheck/test scripts, husky + commitlint. Realises: NFR-060.

### US-181 CI pipeline (P0) — GitHub Actions: install, lint, typecheck, test, build on PR; required checks on `develop`/`main`. Realises: NFR-061.

### US-182 Environments (P0) — local (Docker Postgres or Supabase CLI), staging, production with separate Supabase projects and secrets. Realises: NFR-062.

### US-183 Database migrations & seed (P0) — Prisma migrations in VCS; seed project, admin, queries, taxonomy version. Realises: NFR-063.

### US-184 Shared contracts package (P0) — Zod schemas & types shared by FE/BE; OpenAPI generated from NestJS. Realises: NFR-064.

### US-185 Untitled UI foundation (P0) — theme, tokens, app shell, badge semantics for sentiment/safety. Realises: NFR-030.

### US-186 Test infrastructure (P0) — Jest (api), Vitest (web/packages), Playwright E2E smoke, fixtures for Threads responses. Realises: NFR-065.

### US-187 Security baseline (P0) — helmet, CORS allow-list, rate limiting for admin actions, secret redaction, dependency audit in CI. Realises: NFR-010…

### US-188 Performance baseline (P0) — indexes per data model, p95 targets measured with seeded 100 k posts. Realises: NFR-001…

### US-189 Deployment (P0) — staging & production deploy pipelines; runbook. Realises: NFR-062.

### US-190 Documentation upkeep (P0) — docs updated in the same PR as behaviour changes (DoD). Realises: NFR-070.
