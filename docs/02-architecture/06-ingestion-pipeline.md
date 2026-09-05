# 06 · Ingestion Pipeline (Scheduler → Collector → Storage)

| Field  | Value                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0) — parameters may be re-baselined after POC (M1)                                                                                                          |
| Source | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §7–§8 · [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §7–§9 |
| Code   | `apps/api/src/modules/collector/`, `apps/api/src/modules/integrations/threads/`                                                                                                   |
| Rules  | BR-001…BR-015 · FR-070…FR-089                                                                                                                                                     |

## 1. Components

| Component                  | Responsibility                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `SchedulerService`         | 60 s tick; claim due queries; dispatch `CollectorService.runQuery` with bounded concurrency; circuit-breaker awareness         |
| `WindowCalculator`         | pure function computing `[since, until]` (FR-072)                                                                              |
| `ThreadsDiscoveryProvider` | `search(input) → SearchPage` over Meta Threads keyword search; pagination; field selection; error mapping; rate-limit metadata |
| `PostNormalizer`           | provider item → `NormalizedPost` (FR-074/075)                                                                                  |
| `IngestionService`         | per-page transaction: upsert post, matches, change detection, term filtering, enqueue analysis                                 |
| `SyncJobRecorder`          | job row lifecycle + counters                                                                                                   |
| `CircuitBreaker`           | in-DB state (`collector_state` row per project) so it survives restarts and is shared across instances                         |

## 2. Provider adapter

```ts
export interface SocialDiscoveryProvider {
  readonly platform: Platform; // 'threads'
  search(input: SearchInput, ctx: ProviderContext): Promise<SearchPage>;
  verifyConnection(ctx: ProviderContext): Promise<ConnectionInfo>;
}
export type SearchInput = {
  query: string;
  searchMode: "KEYWORD" | "TAG";
  searchType: "RECENT" | "TOP";
  since?: Date;
  until?: Date;
  limit?: number;
  cursor?: string;
};
export type SearchPage = {
  items: ProviderItem[];
  nextCursor?: string;
  rateLimit?: { remaining?: number; resetAt?: Date; raw?: Record<string, string> };
  requestDurationMs: number;
};
export type ProviderContext = { accessToken: string; requestId: string; projectId: string };
```

- Requested fields (verify in POC): `id, media_type, media_url, permalink, username, text, timestamp, shortcode, thumbnail_url, is_quote_post, quoted_post, reposted_post, has_replies, alt_text, link_attachment_url`.
- Mapping: `query_type=keyword → search_mode=KEYWORD`, `topic_tag → TAG`; `#` stripped before sending.
- Timeout per request `THREADS_REQUEST_TIMEOUT_MS=15000`; `User-Agent` set; JSON parsed defensively.
- Error mapping (FR-082): HTTP 401 → `THREADS_UNAUTHORIZED`; 403 → `THREADS_FORBIDDEN`; 429 → `THREADS_RATE_LIMITED` (`Retry-After` parsed); 5xx → `THREADS_UPSTREAM_ERROR`; network/timeout → `THREADS_TIMEOUT`; invalid JSON/shape → `THREADS_MALFORMED_RESPONSE`. Meta error subcodes stored in `error_message`.
- Contract fixtures recorded during POC live in `apps/api/src/modules/integrations/threads/__fixtures__/` and back `FakeThreadsProvider`.

## 3. Scheduling

- Tick every 60 s (`@Interval`). Skip entirely if circuit open for the project or integration status ∉ {connected}.
- Claim: SQL in [02-backend-design.md §6](02-backend-design.md#6-scheduling--workers); `COLLECTOR_MAX_CONCURRENT_QUERIES=3`, stale lock `COLLECTOR_LOCK_STALE_MINUTES=15`.
- After run: `next_run_at = completed_at + poll_interval_seconds` on success/partial; on failure `next_run_at = now() + min(poll_interval × 2^consecutive_failures, 3600 s)`; `consecutive_failures` reset on success.
- Manual run (`/run`) inserts a `queued` job with `trigger=manual` processed by the next tick ahead of scheduled ones; only one non-terminal job per query at a time.
- Backfill (P1) jobs use explicit `window_since/until`; they may span many pages; `COLLECTOR_MAX_PAGES_PER_JOB` applies per job and resumes via `last_cursor` on retry.

## 4. Window calculation (FR-072)

```ts
function computeWindow(q: QueryState, now: Date, cfg): { since: Date; until: Date } {
  const until = now;
  if (!q.lastSuccessfulSyncAt) return { since: subDays(now, q.initialBackfillDays || 1), until };
  const since = subSeconds(q.lastSuccessfulSyncAt, q.overlapSeconds);
  return { since: max(since, subDays(now, cfg.maxWindowDays)), until };
}
```

Edge cases (unit tests): first run; overlap > interval; clock skew (since > until → since = until − overlap); `maxWindowDays` clamp; provider not supporting `since/until` (then filter client-side by `published_at` and stop paginating when items are older than `since` in `RECENT` order).

## 5. Run algorithm

```text
job = insert sync_jobs(status=running, trigger, window, search_type/mode)
cursor = job.trigger == retry ? previous.last_cursor : undefined
loop pages (≤ MAX_PAGES):
  page = provider.search({...}, ctx)             # retries inside (see §7)
  job.provider_requests++ ; record rateLimit → rate_limit_events / provider_usage
  normalized = normalize(page.items) → {valid[], invalid[]}
  tx:
    for each valid item: ingest(item) → inserted|updated|duplicate ; match upsert ; excluded flag
    enqueue analysis for inserted/updated (unless excluded by all matches)
    update job counters ; job.last_cursor = page.nextCursor
  if !page.nextCursor or oldestItem < since (RECENT) → break
finish:
  status = pages_ok && no error ? success : (pages_ok>0 ? partial : failed)
  update query: last_run_at, last_successful_sync_at (= window_until when success; = oldest processed page time when partial), next_run_at, errors, consecutive_failures, unlock
```

`last_successful_sync_at` on `partial`: set to `window_until` only if the failure happened after all pages within the window were processed; otherwise keep previous value so the next window re-covers the gap (overlap handles the rest).

## 6. Ingestion & deduplication (FR-074…FR-079, FR-088)

```text
normalize: text = NFC(trim(text ?? '')); published_at = parse(timestamp) ; require id & timestamp
content_hash = sha256(`${text}|${media_type ?? ''}|${link_attachment_url ?? ''}`)
upsert social_posts ON CONFLICT (platform, platform_post_id) DO UPDATE
  SET last_seen_at = now(),
      -- only when hash changed:
      text = EXCLUDED.text, ..., content_hash = EXCLUDED.content_hash, revision = social_posts.revision + 1, updated_at = now()
  RETURNING (xmax = 0) AS inserted, (content_hash changed) AS changed
upsert post_query_matches (post_id, query_id) SET last_matched_at = now(), excluded_by_terms = <computed>
if inserted → counters.inserted++, enqueue(run trigger=ingest)
elif changed → counters.updated++, mark current run stale, enqueue(run trigger=content_change)
else → counters.duplicated++
```

Term filtering (BR-007): `excluded = excludeTerms.some(t => norm(text).includes(norm(t))) || (includeTerms.length && !includeTerms.some(...))`. `records_excluded++` when excluded for this query. Analysis is enqueued only if the post has ≥ 1 non-excluded match.

`raw_data` keeps the requested fields only; if JSON > 32 KB, store the first-level scalar fields and set `raw_truncated=true`.

## 7. Retry, backoff, circuit (FR-083, FR-084)

| Failure                 | Behaviour                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| 429                     | wait `Retry-After` if present else backoff; `rate_limit_events++`; retry ≤ `COLLECTOR_MAX_RETRIES=3` |
| 5xx / timeout / network | exponential backoff `base 2 s × 2^attempt`, cap 60 s, full jitter; retry ≤ 3                         |
| 401                     | no retry; job `failed THREADS_UNAUTHORIZED`; integration `expired`; pause scheduling for project     |
| 403                     | no retry; `THREADS_FORBIDDEN`; integration `permission_error`                                        |
| 400                     | no retry; `failed` with provider message (likely query/param issue)                                  |
| malformed               | no retry; `failed THREADS_MALFORMED_RESPONSE`; raw body sample logged (truncated, no token)          |

Circuit breaker: `collector_state(project_id, consecutive_provider_failures, circuit_open_until, reason)`. Open after `COLLECTOR_CIRCUIT_FAILURE_THRESHOLD=5` consecutive failed jobs (any query); half-open after `COLLECTOR_CIRCUIT_OPEN_SECONDS=600` (one probe job); close on success. System Status shows `collector.status=paused` with reason.

## 8. Idempotency & concurrency guarantees

- Uniqueness constraints make re-processing any page safe.
- Page-level transactions keep partial progress.
- Query claiming prevents concurrent runs of the same query across instances; analysis enqueue is `INSERT … ON CONFLICT DO NOTHING` on `(post_id, source_content_hash, effective_version) WHERE status IN (pending, processing)` (partial unique index) so double enqueue is impossible.

## 9. Observability (per job)

Log lines with `job_id, query_id, project_id, provider='threads', page, status, duration_ms, result_count, error_code`. Metrics per [09-observability.md](09-observability.md). Rate-limit headers recorded raw in `provider_usage` for POC learning.

## 10. Configuration

| Env                                   | Default                          | Meaning                              |
| ------------------------------------- | -------------------------------- | ------------------------------------ |
| `COLLECTOR_TICK_MS`                   | 60000                            | scheduler interval                   |
| `COLLECTOR_MAX_CONCURRENT_QUERIES`    | 3                                | per instance                         |
| `COLLECTOR_MAX_PAGES_PER_JOB`         | 50                               | cap                                  |
| `COLLECTOR_PAGE_LIMIT`                | 50                               | provider `limit` (verify max in POC) |
| `COLLECTOR_MAX_RETRIES`               | 3                                | per request                          |
| `COLLECTOR_LOCK_STALE_MINUTES`        | 15                               | claim expiry                         |
| `COLLECTOR_MAX_WINDOW_DAYS`           | 30                               | clamp                                |
| `COLLECTOR_MAX_BACKFILL_DAYS`         | 30                               | backfill validation                  |
| `COLLECTOR_CIRCUIT_FAILURE_THRESHOLD` | 5                                |                                      |
| `COLLECTOR_CIRCUIT_OPEN_SECONDS`      | 600                              |                                      |
| `THREADS_API_BASE_URL`                | `https://graph.threads.net/v1.0` | verify in POC                        |
| `THREADS_REQUEST_TIMEOUT_MS`          | 15000                            |                                      |

## 11. Open questions for POC (M1)

Max `limit`; whether `since/until` are honoured for `TAG` mode; max pages per query; lag between post time and searchability; behaviour for deleted posts; whether `TOP` returns a cursor; rate-limit headers exposed; long-lived token refresh endpoint & lifetime. Answers go to [../05-operations/01-poc-threads-api.md](../05-operations/01-poc-threads-api.md) and update this doc.
