# 06 · Business Rules & Glossary

| Field  | Value                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0)                                                                        |
| Source | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §6–§10, §16–§17 |

## 1. Business rules

Rules are normative and referenced by code comments (`// BR-007`) and tests.

### Identity & deduplication

- **BR-001** A social post's identity is `(platform, platform_post_id)`. One row in `social_posts` per identity, regardless of how many queries matched it.
- **BR-002** A post matched by several listening queries has one `post_query_matches` row per query. Project-wide counts are `COUNT(DISTINCT post_id)`; per-query breakdowns may count the same post under each query.
- **BR-003** `content_hash` is computed over normalised text + media type + link attachment URL. Only a changed hash counts as a content change (`revision++`).

### Listening queries

- **BR-004** `query_value` never contains a leading `#`; the UI renders `#` for topic tags.
- **BR-005** `query_type=keyword → search_mode=KEYWORD`; `query_type=topic_tag → search_mode=TAG`.
- **BR-006** Uniqueness of a query is `(project_id, platform, query_type, lower(query_value))` among non-deleted queries.
- **BR-007** Exclude/include terms are applied after ingestion, case-insensitive, Unicode NFC-normalised, substring match on post text. A post excluded for a query is stored but not counted for that query. A post excluded by every matched query is not analysed.
- **BR-008** Scheduled listening uses `search_type=RECENT`. `TOP` results may be used for exploration/backfill but are never mixed into time-series totals without dedupe and window filtering.
- **BR-009** `query_value` and `query_type` are immutable after creation.
- **BR-010** Soft-deleted queries keep all history; they are hidden from default lists and excluded from scheduling.

### Collection

- **BR-011** Search window: `since = last_successful_sync_at − overlap_seconds`, `until = now()`; first run `since = now() − initial_backfill_days`.
- **BR-012** Defaults: poll interval 600 s, overlap 1 200 s; both configurable per query.
- **BR-013** Duplicate discovery inside the overlap is expected; it only updates `last_seen_at`.
- **BR-014** A job that fetched ≥ 1 page successfully and then failed is `partial`, not `failed`; collected data is kept.
- **BR-015** Provider quotas are never hard-coded; rate-limit signals are recorded and surfaced.

### Analysis

- **BR-016** Relevance has three states. Dashboards include `relevant` by default, optionally `uncertain`, never `irrelevant` unless the user explicitly filters for it.
- **BR-017** Sentiment and safety are independent. `negative` ≠ `unsafe`. Never derive one from the other.
- **BR-018** `safe | sensitive | severe` is a product policy mapping over provider categories; the mapping is versioned (`safety_policy_version`) and configurable.
- **BR-019** Intent and topic are multi-label; their percentages need not sum to 100 %.
- **BR-020** `model_confidence` is an estimated, uncalibrated signal used for prioritisation and review, never presented as probability.
- **BR-021** Confidence bands v1: high ≥ 0.80 (auto-accept), medium 0.60–0.79 (accepted, visually marked), low < 0.60 (review queue / treated as `uncertain` for relevance).
- **BR-022** Summary is produced only for `relevant`/`uncertain` content with non-empty text; skipped for spam when configured.
- **BR-023** Every analysis result carries `classifier_provider, classifier_model, prompt_version, taxonomy_version, safety_provider, safety_model, safety_policy_version, analyzed_at`.
- **BR-024** Identical `(source_content_hash, effective_version)` is never analysed twice unless forced by an Admin.
- **BR-025** Effective value for analytics = active analyst override > latest completed AI analysis.
- **BR-026** Re-analysis creates a new run; previous runs are retained for audit/comparison.
- **BR-027** Hidden model reasoning (chain-of-thought) is never stored; only a short user-facing explanation.

### Analytics

- **BR-028** All timestamps stored in UTC; bucketing and previous-period boundaries follow the selected timezone (default project timezone `Asia/Ho_Chi_Minh`).
- **BR-029** Previous period = equal-length window immediately before the current window.
- **BR-030** Growth with previous = 0 is displayed as `New`, never as ∞ or NaN.
- **BR-031** Rate denominators only include mentions whose relevant dimension is `completed` (see metric definitions).
- **BR-032** "0 mentions", "sync failed" and "analysis pending" are distinct states and must be displayed as such.

### Access & audit

- **BR-033** Authorization is enforced by the backend; the frontend only mirrors it.
- **BR-034** All admin mutations are audited with actor, action, entity, metadata (no secrets).
- **BR-035** The last Admin of a project cannot be removed or downgraded.
- **BR-036** Secrets (Threads token, OpenAI key, service-role key) never leave the server.

### Data

- **BR-037** Media binaries are never stored; only URLs/thumbnail URLs returned by the API.
- **BR-038** Only requested API fields are stored in `raw_data`; no enrichment from the public website.
- **BR-039** Retention is configurable; purge operations are explicit and audited.

## 2. Glossary

| Term                      | Definition                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Mention**               | A stored `social_posts` row (a public Threads post discovered by a listening query).                 |
| **Relevant mention**      | Mention whose effective relevance is `relevant`.                                                     |
| **Listening query**       | A configured keyword or topic tag that the collector searches on a schedule.                         |
| **Query match**           | Link between a post and a query that returned it (`post_query_matches`).                             |
| **Monitoring project**    | Logical listening scope (brand/artist/event); MVP has one.                                           |
| **Sync job**              | One execution of a query search window with counters (`sync_jobs`).                                  |
| **Backfill**              | A manual sync over a historical window.                                                              |
| **Overlap**               | Extra time re-fetched before `last_successful_sync_at` to catch late-indexed posts.                  |
| **Collection lag**        | `now − max(last_successful_sync_at)` across enabled queries.                                         |
| **Analysis run**          | One versioned execution of the analysis pipeline for a post revision (`analysis_runs`).              |
| **Effective analysis**    | Latest completed run overlaid with active analyst overrides.                                         |
| **Relevance**             | `relevant / uncertain / irrelevant` — is this post about 1Zone/Eventista?                            |
| **Sentiment**             | `positive / neutral / negative` attitude expressed.                                                  |
| **Safety level**          | `safe / sensitive / severe` product policy mapping over moderation categories.                       |
| **Intent**                | Multi-label purpose of the post (complaint, question, purchase_intent…).                             |
| **Topic**                 | Multi-label subject of the post (artist, ticket, price…).                                            |
| **model_confidence**      | Estimated confidence from the classifier; prioritisation only.                                       |
| **Taxonomy version**      | Version string of the label sets (e.g. `taxonomy-v1`).                                               |
| **Prompt version**        | Version string of the classifier prompt (e.g. `classifier-v1`).                                      |
| **Safety policy version** | Version string of the category→level mapping (e.g. `safety-policy-v1`).                              |
| **Coverage**              | Share of relevant mentions in a range that have completed analysis.                                  |
| **Drill-down**            | Navigating from an aggregate (KPI/chart segment) to the underlying mentions with equivalent filters. |
| **Circuit breaker**       | Temporary pause of provider calls after repeated failures.                                           |
| **RECENT / TOP**          | Threads search types: chronological recent results vs ranked top results.                            |
| **KEYWORD / TAG**         | Threads search modes: free-text keyword vs topic tag.                                                |
| **Soft delete**           | Marking `deleted_at` instead of removing the row.                                                    |
| **Audit log**             | Immutable record of who did what to which entity and when.                                           |
