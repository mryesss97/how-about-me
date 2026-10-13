# 05 · REST API Contract (v1)

| Field  | Value                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0) — changes are additive within v1; breaking → `/api/v2`                                             |
| Source | [00-source/03_DATA_MODEL_AND_API.md](../00-source/03_DATA_MODEL_AND_API.md) §6–§15                                          |
| Code   | `packages/contracts/src/**` (Zod schemas = the contract), `apps/api/src/modules/**/*.controller.ts`, OpenAPI at `/api/docs` |

## 1. Conventions

| Item              | Rule                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Base              | `/api/v1`                                                                                                                        |
| Content           | `application/json; charset=utf-8`                                                                                                |
| Auth              | `Authorization: Bearer <Supabase access JWT>`; `/health/*` public                                                                |
| IDs               | UUID strings; provider ids as strings                                                                                            |
| Dates             | ISO-8601 with offset (`2026-09-05T01:00:00+07:00`) or `Z`; responses UTC `Z` unless bucketed (then in requested tz)              |
| Arrays in query   | repeat key `sentiment=positive&sentiment=negative` (also accepts comma list)                                                     |
| Booleans in query | `true`/`false`/`1`/`0` only; any other value → `400 VALIDATION_ERROR`                                                            |
| Date range        | `from`/`to` require offset (no date-only); `to > from`; span ≤ 366 days                                                          |
| Pagination        | cursor: `?cursor=<opaque>&limit=25` → `{ items, nextCursor, totalCount? }`; `count=true` adds `totalCount` (bounded cost)        |
| Errors            | `{ "error": { "code": "QUERY_DUPLICATE", "message": "…", "requestId": "…", "details"?: {...} } }`                                |
| Rate limit        | `429 RATE_LIMITED` with `Retry-After`                                                                                            |
| Request id        | `x-request-id` echoed                                                                                                            |
| Roles             | see permission matrix [../01-product/02-personas-rbac.md](../01-product/02-personas-rbac.md#3-permission-matrix-server-enforced) |

Cursors are opaque. A malformed, tampered or legacy cursor (one issued before a cursor format change, e.g. #188) returns `400 VALIDATION_ERROR` and the client resets to the first page. Timestamp sort keys inside a cursor keep full `timestamptz` µs precision, so rows created in the same millisecond are never skipped or repeated (#188).

## 2. Auth & user

### `GET /me`

```json
{
  "id": "uuid",
  "email": "a@x.com",
  "displayName": "Linh",
  "projects": [
    {
      "id": "uuid",
      "name": "1Zone / Eventista Social Listening",
      "slug": "1zone-eventista",
      "timezone": "Asia/Ho_Chi_Minh",
      "role": "analyst",
      "settings": { "allowAnalystReanalyze": true, "allowViewerExport": false }
    }
  ]
}
```

## 3. Projects & members

| Method & path                                 | Role   | Body / query                                                                      | Response                                             |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /projects`                               | any    | —                                                                                 | `Project[]` with `role`                              |
| `GET /projects/:projectId`                    | member | —                                                                                 | `Project`                                            |
| `PATCH /projects/:projectId`                  | admin  | `{ name?, timezone?, settings?: { allowAnalystReanalyze?, allowViewerExport? } }` | `Project`                                            |
| `GET /projects/:projectId/members`            | admin  | —                                                                                 | `Member[] {userId,email,displayName,role,createdAt}` |
| `POST /projects/:projectId/members`           | admin  | `{ email, role }`                                                                 | `Member` (201) · `409 MEMBER_EXISTS`                 |
| `PATCH /projects/:projectId/members/:userId`  | admin  | `{ role }`                                                                        | `Member` · `409 LAST_ADMIN`                          |
| `DELETE /projects/:projectId/members/:userId` | admin  | —                                                                                 | 204 · `409 LAST_ADMIN`                               |

`PATCH /projects/:projectId` (FR-032, T-034): body must have at least one field; `timezone` must be a valid IANA zone (`Intl.DateTimeFormat`, aliases such as `UTC` accepted) else `400 VALIDATION_ERROR`. `settings` is merged per key — unsent keys keep their current value. Only fields that actually change are written; the change is audited as `project.updated` in the same transaction with metadata `{ changes: { name?|timezone?|"settings.<key>"?: { from, to } } }` (no secrets). A no-op patch returns `200` with the current project and writes no audit row.

Members (FR-033…FR-035, T-035): email is trimmed and lower-cased. An email with no profile gets a placeholder `user_profiles` row (`last_login_at = null`), re-keyed to the Supabase `sub` on first login (FR-017). Email already a member of the project → `409 MEMBER_EXISTS` (no row, no audit). `PATCH`/`DELETE` on a `userId` that is not a member → `404 NOT_FOUND`; same role → `200` no-op without audit. Demoting or removing the last admin → `409 LAST_ADMIN`; member mutations are serialized per project (row lock) so concurrent demotions cannot leave zero admins. Audited in the same transaction: `member.added {email, role}`, `member.role_changed {role, previousRole}`, `member.removed {email, previousRole}`. Role changes/removal take effect on the next request. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set and the profile has never logged in, the API sends a Supabase invite email after commit — best-effort (failure logged at warn, response still `201`).

## 4. Integrations (Threads)

| Method & path                                           | Role   | Body                                                   | Response                                                                                                                           |
| ------------------------------------------------------- | ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `GET /projects/:projectId/integrations/threads`         | member | —                                                      | `{ status, accountIdentifier, grantedScopes[], tokenExpiresAt, lastVerifiedAt, lastSuccessAt, lastError:{code,message,at}\|null }` |
| `PUT /projects/:projectId/integrations/threads`         | admin  | `{ accessToken, accountIdentifier?, tokenExpiresAt? }` | status object (token never echoed)                                                                                                 |
| `POST /projects/:projectId/integrations/threads/verify` | admin  | —                                                      | status object after live check                                                                                                     |
| `DELETE /projects/:projectId/integrations/threads`      | admin  | —                                                      | 204 (status → disconnected, secret purged)                                                                                         |

## 5. Listening queries

### `GET /projects/:projectId/listening-queries`

Query: `enabled?`, `type?`, `includeDeleted?=false`, `cursor?`, `limit?=50`.

```json
{ "items":[{ "id":"uuid","displayName":"Eventista","queryValue":"eventista","queryType":"keyword","searchMode":"KEYWORD",
  "enabled":true,"excludeTerms":[],"includeTerms":[],"pollIntervalSeconds":600,"overlapSeconds":1200,"initialBackfillDays":1,
  "nextRunAt":"…","lastRunAt":"…","lastSuccessfulSyncAt":"…","lastError":{"code":"THREADS_RATE_LIMITED","message":"…","at":"…"}|null,
  "lastJob":{"id":"uuid","status":"success","recordsFetched":40,"recordsInserted":3,"completedAt":"…"}|null,
  "matchedPosts":{"total":1240,"last24h":37},
  "createdBy":{"id":"uuid","displayName":"Minh"},"createdAt":"…","updatedAt":"…","deletedAt":null }], "nextCursor":null }
```

### `POST /projects/:projectId/listening-queries` (admin) → 201

```json
{
  "displayName": "Eventista",
  "queryValue": "eventista",
  "queryType": "keyword",
  "excludeTerms": ["time zone"],
  "includeTerms": [],
  "pollIntervalSeconds": 600,
  "overlapSeconds": 1200,
  "initialBackfillDays": 1,
  "enabled": true
}
```

Errors: `400 VALIDATION_ERROR`, `409 QUERY_DUPLICATE {details:{existingId}}`.

| Method & path                           | Role       | Notes                                                                                                                                              |
| --------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET …/listening-queries/:id`           | member     |                                                                                                                                                    |
| `PATCH …/listening-queries/:id`         | admin      | mutable: `displayName, excludeTerms, includeTerms, pollIntervalSeconds, overlapSeconds, initialBackfillDays, enabled`; `400 QUERY_IMMUTABLE_FIELD` |
| `DELETE …/listening-queries/:id`        | admin      | soft delete → 204                                                                                                                                  |
| `POST …/listening-queries/:id/restore`  | admin      | → query                                                                                                                                            |
| `POST …/listening-queries/:id/run`      | admin      | → `202 { jobId, status:"queued" }` · `409 SYNC_ALREADY_RUNNING {details:{jobId}}`                                                                  |
| `POST …/listening-queries/:id/backfill` | admin (P1) | body `{ since, until, searchType?: "RECENT"\|"TOP" }` → `202 { jobId, status:"queued" }` · `400 BACKFILL_WINDOW_INVALID`                           |

Behaviour notes (T-042, FR-051…FR-057):

- List order is `createdAt desc, id desc` (keyset cursor); `count=true` adds `totalCount`. `GET :id` also returns soft-deleted queries (with `deletedAt`).
- Duplicates (BR-006) compare `lower(queryValue)` after `#`-strip, per `(project, platform, queryType)`, active rows only → `409 QUERY_DUPLICATE {details:{existingId}}` (also on concurrent creates).
- `PATCH` with a `queryValue`/`queryType` key → `400 QUERY_IMMUTABLE_FIELD {details:{fields}}`, whatever the value; other unknown keys are stripped. Empty body → `400 VALIDATION_ERROR`. A body with no real change → `200`, no write, no audit. `PATCH` on a soft-deleted query → `404` (restore first).
- Scheduling: create with `enabled=true` → `nextRunAt = now`; `enabled=false` → `nextRunAt = null`. Re-enabling, or restoring an enabled query → `nextRunAt = now`. Disabling keeps `nextRunAt` (scheduler skips disabled). Changing `pollIntervalSeconds` does not reschedule the pending run.
- `DELETE` on an already deleted query → `204` no-op. Soft delete keeps `enabled`, matches, jobs and posts (BR-010). `restore` on a non-deleted query → `200` no-op; `409 QUERY_DUPLICATE` if an active duplicate exists.
- Audit (BR-034): `query.created|updated|enabled|disabled|deleted|restored`; `query.updated` metadata `{ fields, before, after }`. A PATCH changing `enabled` and other fields writes two rows.
- Until T-045, `lastJob` is `null` and `matchedPosts` is `{ total: 0, last24h: 0 }` (placeholders).

## 6. Analytics

Common query params (all optional): `from`, `to` (defaults last 7 d), `timezone` (default project tz), `queryIds[]`, `relevance[]` (default `relevant`), `sentiment[]`, `safety[]`, `intent[]`, `topic[]`, `language[]`, `analysisStatus[]`, `compare=false`, `timeField=published_at`.

- Default range = `[now − 7×24h, now)` (same as the web `7d` preset). Only `from` sent → `to = from + 7×24h`; only `to` → `from = to − 7×24h`; the derived range is still checked (`to > from`, ≤ 366 d → `400 VALIDATION_ERROR`).
- With `queryIds` empty, the base set uses matches of every project query, soft-deleted included (BR-010); matches with `excluded_by_terms=true` never count.
- Response `range.from/to` (and `previous`) are ISO 8601 with the selected timezone's offset (e.g. `2026-09-04T00:00:00+07:00`); inputs accept `Z` or any offset.

### `GET /projects/:projectId/analytics/overview`

```json
{
  "meta": { "metricsVersion": "metrics-v1", "generatedAt": "…" },
  "range": {
    "from": "2026-09-04T00:00:00+07:00",
    "to": "2026-09-05T00:00:00+07:00",
    "timezone": "Asia/Ho_Chi_Minh",
    "previous": { "from": "…", "to": "…" }
  },
  "coverage": {
    "relevantMentions": 2481,
    "analyzedMentions": 2410,
    "pendingMentions": 61,
    "failedMentions": 10,
    "irrelevantMentions": 312,
    "uncertainMentions": 45
  },
  "dataQuality": {
    "lastSyncStatus": "success",
    "lastSyncAt": "…",
    "integrationStatus": "connected",
    "collectorStatus": "healthy"
  },
  "kpis": {
    "mentionCount": { "value": 2481, "previous": 2043, "growthPct": 21.4, "growthState": "up" },
    "positiveRate": { "value": 0.62, "numerator": 1494, "denominator": 2410, "previous": 0.58 },
    "negativeRate": { "value": 0.18, "numerator": 434, "denominator": 2410, "previous": 0.21 },
    "safetyRiskRate": { "value": 0.032, "numerator": 77, "denominator": 2410, "severeCount": 9, "previous": 0.028 },
    "complaintRate": { "value": 0.28, "numerator": 675, "denominator": 2410, "previous": 0.25 }
  }
}
```

`growthPct: null, growthState:"new"` when previous = 0; rates `null` when denominator = 0.
`growthPct` is a percentage rounded to 1 decimal (`21.4` = +21.4 %); `flat` when |growth| < 0.5 %. `kpis.mentionCount` growth is always computed; `range.previous` and each rate's `previous` are present only when `compare=true`. Any project role (viewer+) may call it. Definitions: metric-definitions §1–§2.

### `GET …/analytics/mentions-timeseries`

```json
{
  "interval": "hour",
  "timezone": "Asia/Ho_Chi_Minh",
  "data": [{ "time": "2026-09-05T01:00:00+07:00", "mentions": 42, "previous": 37 }]
}
```

Query: common analytics query (§6) + `interval=hour|day` (optional). Omitted → `hour` if range ≤ 48 h, else `day`. `day` is always valid; `hour` only when range ≤ 31 days (≤ 744 points), otherwise `400 VALIDATION_ERROR`. Buckets are zero-filled in the requested timezone; the first bucket may be partial when `from` is not on a bucket boundary. `previous` is present only when `compare=true` (aligned by bucket position, metric-definitions §3.1). Roles: admin, analyst, viewer.

### `GET …/analytics/sentiment`

```json
{
  "denominator": 2410,
  "distribution": [
    { "label": "positive", "count": 1494, "share": 0.62 },
    { "label": "neutral", "count": 482, "share": 0.2 },
    { "label": "negative", "count": 434, "share": 0.18 }
  ],
  "timeseries": { "interval": "day", "data": [{ "time": "…", "positive": 10, "neutral": 4, "negative": 3 }] }
}
```

- `denominator` = `sentimentAnalyzed` (= positive + neutral + negative); labels in fixed taxonomy order.
- `timeseries`: always returned; `interval` = `hour` when range ≤ 48 h else `day`; buckets are local-time starts in the request timezone, zero-filled over `[from, to)`.

### `GET …/analytics/safety` → `{ denominator, distribution:[{label:"safe"|"sensitive"|"severe",count,share}] }`

`denominator` = `safetyAnalyzed` (= sum of the three counts); fixed taxonomy order.

### `GET …/analytics/intents` → `{ denominator, distribution:[{label,count,share}] }` (all labels)

`denominator` = `intentAnalyzed` (posts with ≥ 1 intent). All 11 labels, count 0 included, sorted by count desc (ties keep taxonomy order). Shares may sum > 100 %.

### `GET …/analytics/topics` → `{ denominator, distribution:[{label,count,share}] }` (top 12 + other)

`denominator` = `topicAnalyzed` (posts with ≥ 1 topic). Real topic labels (taxonomy `other` excluded) sorted by count desc (ties by taxonomy order), at most 12, then one `other` entry = `COUNT(DISTINCT post_id)` of posts tagged `other` or with a label outside the top 12 (distinct, not a sum). Shares may sum > 100 %.

All four distribution endpoints (T-093): every label is returned even with count 0; `share` is `null` when `denominator` = 0; counts are `COUNT(DISTINCT post_id)` over the base set; roles admin / analyst / viewer.

### `GET …/analytics/languages` (P1) → same shape

FR-143 (T-148). `denominator` = `COUNT(DISTINCT post_id)` of base-set posts with `language_code IS NOT NULL` (posts without analysis are excluded; `unknown` is an assigned value and is counted). Codes outside the taxonomy (`vi,en,ko,ja,th,zh,other,unknown`) are folded into `other`. All 8 codes returned (count 0 included), sorted by count desc, ties in taxonomy order; shares sum to 100 % (single-label), `null` when `denominator` = 0. Roles admin / analyst / viewer; filters as for the other distribution endpoints (incl. `language[]`).

### `GET …/analytics/topic-sentiment` (P1) → `{ rows:[{topic, positive, neutral, negative, total, negativeShare}] }`

### `GET …/analytics/query-share` (P1) → `{ denominator, distribution:[{queryId, displayName, count, share}] , note:"overlapping" }`

## 7. Mentions

### `GET /projects/:projectId/mentions`

Query: `from,to,timezone,queryIds[],q,relevance[] (default relevant),sentiment[],safety[],intent[],topic[],language[],analysisStatus[],reviewStatus[] (P1),sort=newest|oldest|safety_desc|confidence_asc|relevance_desc,cursor,limit=25 (max 100),count=false`.

```json
{
  "items": [
    {
      "id": "uuid",
      "platform": "threads",
      "platformPostId": "1789…",
      "username": "fan_abc",
      "permalink": "https://www.threads.net/@fan_abc/post/C…",
      "publishedAt": "2026-09-04T13:20:00Z",
      "text": "…",
      "mediaType": "IMAGE",
      "thumbnailUrl": "…",
      "hasReplies": true,
      "isQuotePost": false,
      "matchedQueries": [
        { "id": "uuid", "displayName": "Eventista", "queryType": "keyword", "excludedByTerms": false }
      ],
      "analysis": {
        "status": "completed",
        "source": "ai",
        "relevance": { "label": "relevant", "confidence": 0.97 },
        "sentiment": { "label": "negative", "confidence": 0.91 },
        "safety": { "level": "safe" },
        "intents": [{ "label": "complaint", "confidence": 0.95 }],
        "topics": [
          { "label": "ticket", "confidence": 0.98 },
          { "label": "price", "confidence": 0.96 }
        ],
        "language": "vi",
        "summary": "User complains that ticket prices are high.",
        "overallConfidence": 0.91,
        "confidenceBand": "high",
        "hasOverride": false
      }
    }
  ],
  "nextCursor": "eyJ…",
  "totalCount": 2481
}
```

**List (T-095, FR-150/152/153/161).**

- Base set = analytics §6 (metric-definitions §0/§6): default range `[now − 7×24h, now)`, `relevance` default `relevant` (BR-016), ≥1 match with `excluded_by_terms=false` (BR-007), empty `queryIds` includes soft-deleted queries (BR-010), effective analysis incl. active overrides (BR-025). One row per post (BR-002). Posts never analysed have NULL labels and drop out under the default relevance; send `relevance=` (empty) to include them.
- Sorts (NULLs last, tie-breaker `published_at DESC, post_id`): `newest` = `published_at DESC`; `oldest` = `published_at ASC, post_id ASC`; `safety_desc` = severe > sensitive > safe > none; `confidence_asc` = `overall_model_confidence ASC`; `relevance_desc` = label rank (relevant > uncertain > irrelevant) then `relevance_confidence DESC`.
- `cursor` is opaque and bound to `sort`; malformed, tampered or other-sort cursor → `400 VALIDATION_ERROR`, including keys that do not fit the sort's types (e.g. a non-timestamp key for `newest`, int outside int4, non-decimal numeric) (#195). Timestamp keys are UTC with µs (`YYYY-MM-DDTHH:MI:SS.uuuuuuZ`); mentions cursors issued before #195 are legacy → 400, client resets to page 1. `limit` 1–100 (above → 400, no clamping). Clients must reset the cursor when filters change and dedupe by `id` (re-analysis between pages may move a post under label sorts).
- `q` (NFC, whitespace-collapsed): full-text `websearch_to_tsquery('simple', q)` on `search_vector` (no stemming/unaccent: "gia ve" ≠ "giá vé"); terms < 3 characters or without letters/digits use case-insensitive substring `ILIKE` with `%`/`_` taken literally.
- `count=true` → `totalCount` of the whole filtered set (ignores cursor), equal to the dashboard number for the same filters. Bounded by a 1.5 s `statement_timeout`; on timeout `totalCount` is omitted.
- `matchedQueries` includes matches of soft-deleted queries and `excludedByTerms=true` matches. `analysis.status` = latest run status (`pending` when no run exists); labels stay those of the current analysis while a re-run is pending. `errorCode` only when `status=failed`.
- `reviewStatus` (P1) is accepted and ignored until review state exists.

### `GET /projects/:projectId/mentions/:id`

Adds: `ownerId, shortcode, mediaUrl, altText, linkAttachmentUrl, quotedPostId, repostedPostId, firstSeenAt, lastSeenAt, revision, contentHash`, `analysis.relevanceExplanation`, `analysis.safetyCategoryScores` (`{category: score}` or null), `analysis.safetyTriggered` (`[{category, score, level: sensitive|severe}]` recomputed with the safety policy of the analysis run — currently `safety-policy-v1` only), `analysis.versions {classifierProvider, classifierModel, promptVersion, taxonomyVersion, safetyProvider, safetyModel, safetyPolicyVersion}`, `analysis.analyzedAt`, `analysis.tokens {input, output}, analysis.estimatedCostUsd`, `runs:[{id,status,trigger,effectiveVersion,createdAt,completedAt,errorCode,estimatedCostUsd?}]`, `overrides:[…]` (P1).

**Mention detail (T-096, FR-154).** All member roles. No base-set filter (date range, relevance, excluded matches): irrelevant or unanalysed posts are still readable. Labels are the effective ones (BR-025); explanation, scores, versions, tokens/cost and `analyzedAt` come from the run that produced the **current** AI analysis (not the latest run, which may be pending/failed) — all null when the post has no analysis. `runs` = up to 50 newest runs, `created_at DESC, id DESC` (BR-003). `matchedQueries` includes soft-deleted queries and excluded matches (BR-010). `404 NOT_FOUND` when the mention does not exist or belongs to another project; `400` for a non-UUID id. No raw provider payload.

| Method & path                                 | Role                          | Notes                                                                               |
| --------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `POST …/mentions/:id/reanalyze`               | admin · analyst⚙️             | → `202 { runId, status:"pending" }` · `409 ANALYSIS_ALREADY_PENDING`                |
| `POST …/mentions/reanalyze`                   | admin (P1)                    | body = list filters + `{ dryRun?: boolean }` → `{ matched, enqueued, cap }` · `429` |
| `POST …/mentions/:id/overrides`               | admin, analyst (P1)           | `{ field, value, reason? }` → 201 override                                          |
| `DELETE …/mentions/:id/overrides/:overrideId` | admin, analyst (P1)           | revoke → 204                                                                        |
| `GET …/mentions/export.csv`                   | admin, analyst, viewer⚙️ (P1) | list filters; `413 EXPORT_TOO_LARGE {details:{cap}}`                                |

**Single re-analyze (T-076, FR-115/FR-116).** No body. Creates a new run with `trigger=manual` (force: bypasses the completed-run dedupe; earlier runs are kept, BR-003). `404 NOT_FOUND` when the mention does not exist or belongs to another project. `409 ANALYSIS_ALREADY_PENDING` when the post has **any** `pending|processing` run (any content hash or effective version); the partial unique index (BR-024) still decides concurrent requests and the loser also gets 409. Writes audit `analysis.reanalyze_requested` (`entity_type=social_post`, metadata `{ runId, effectiveVersion }`, no post text) in the same transaction.

**Bulk re-analyze (T-145, FR-196).** Admin only. Body = list filters (same base set as `GET …/mentions`: default last 7×24h, `relevance=[relevant]` BR-016; `reviewStatus` ignored) + `dryRun` (default `false`). Always `200 { matched, enqueued, cap }`. `matched` = DISTINCT posts matching the filters + `q` (equals the list `totalCount` for the same filters). `cap = ANALYSIS_BULK_MAX`. `dryRun=true` only counts: no enqueue, no audit, does not consume the throttle. Otherwise picks up to `cap` posts in `sort` order that have no `pending|processing` run and no `completed` run for the same `(content_hash, current effective_version)` (BR-024, not a force trigger), creates runs `trigger=bulk` (old runs kept, BR-003), and writes audit `analysis.bulk_reanalyze_requested` (`entity_type=monitoring_project`, metadata `{ scope:"filters", filters, counts:{ matched, enqueued, cap }, effectiveVersion }`, no post ids/text) in the same transaction — also when `enqueued=0`. Throttle: one real call per 5 min per project, shared with `mark-stale` (§9), DB-backed (project row lock + last audit row); exceeded → `429 RATE_LIMITED` with header `Retry-After` and `details.retryAfterSeconds`.

**Export (T-147, FR-180/181).** `GET …/mentions/export.csv` — admin, analyst; viewer only when `allowViewerExport` (FR-032, enforced server-side). Query = list filters (`MentionsExportQuerySchema`: same base set B, `q` and `sort` as `GET …/mentions`; default last 7×24h, `relevance=[relevant]` BR-016; one row per post BR-002; no `cursor/limit/count`; `reviewStatus` ignored). Check order: 401/403 → 400 → 429 → 413 → 200.

- `200`: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="mentions-YYYYMMDD-HHmm.csv"` (local time in the request `timezone`, default `Asia/Ho_Chi_Minh`), `Cache-Control: no-store`. Body = UTF-8 BOM + header row + rows, CRLF, RFC 4180 quoting. Cells of `username`, `text`, `summary`, `matched_queries` starting with `= + - @ \t \r` get a leading `'` (CSV formula injection guard). Rows are in list `sort` order; 0 rows → BOM + header.
- Columns (in order): `post_id` (internal UUID), `platform_post_id`, `permalink`, `username`, `text`, `published_at`, `matched_queries` (display names of non-excluded matches incl. soft-deleted queries, BR-007/BR-010), `relevance`, `sentiment`, `safety`, `intents`, `topics`, `language`, `summary`, `analyzed_at` (= `COALESCE(run.completed_at, analysis.created_at)`). Labels are effective values (override > AI, BR-025). Timestamps UTC ISO 8601; multi-values joined with `"; "`; null → empty cell.
- `413 EXPORT_TOO_LARGE { details: { cap } }` (`cap = EXPORT_MAX_ROWS`) when the filtered set has more than `cap` rows — returned as a JSON envelope before any byte is streamed (no truncated file).
- Throttle: 5 successful exports per minute per user across all projects (NFR-017), DB-backed (per-user advisory lock + count of `mentions.exported` audit rows in 60 s); exceeded → `429 RATE_LIMITED`, header `Retry-After`, `details.retryAfterSeconds`. 413/429 do not consume quota.
- Audit `mentions.exported` (`entity_type=monitoring_project`, metadata `{ format:"csv", filters, rowCount }`, no post ids/text), written before streaming, only on success.
- A failure mid-stream (headers already sent) aborts the connection; the client sees a network error and must discard the partial file. The audit row (and its throttle token) was already written before streaming.

## 8. Sync jobs

| Method & path                | Role   | Notes                                                                                                         |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `GET …/sync-jobs`            | member | `queryId?, status[], trigger[], from, to, cursor, limit`                                                      |
| `GET …/sync-jobs/:id`        | member | full counters, window, cursor, error, provider usage                                                          |
| `POST …/sync-jobs/:id/retry` | admin  | for `failed`/`partial` → new job resuming from `last_cursor` when available; `202 { jobId, status:"queued" }` |

Job object:

```json
{ "id":"uuid","queryId":"uuid","status":"partial","trigger":"scheduled","searchType":"RECENT","searchMode":"KEYWORD",
  "windowSince":"…","windowUntil":"…","startedAt":"…","completedAt":"…",
  "pagesFetched":3,"recordsFetched":120,"recordsInserted":15,"recordsUpdated":1,"recordsDuplicated":100,"recordsInvalid":4,"recordsExcluded":2,
  "providerRequests":3,"rateLimitEvents":1,"lastCursor":"…","error":{"code":"THREADS_RATE_LIMITED","message":"…"}|null }
```

## 9. Analysis runs (ops)

| Method & path                                                 | Role   | Notes                                                                                                              |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `GET …/analysis-runs`                                         | member | `status[], from, to, cursor` (used by System Status → Analysis failures)                                           |
| `POST …/analysis-runs/:id/retry`                              | admin  | failed → pending; `202 { runId, status:"pending" }`                                                                |
| `POST …/analysis-runs/retry-failed`                           | admin  | `{ limit ≤ 500 (default 100) }` → `{ enqueued }`                                                                   |
| `POST …/analysis-runs/mark-stale?version=<old>&dryRun=<bool>` | admin  | T-145: → `200 { marked, enqueued, cap }` · `400 VALIDATION_ERROR` (current version) · `429` (shared bulk throttle) |

**Mark stale by version (T-145, BR-023).** In the project, `pending|completed` runs of `version` → `stale`; then up to `cap = ANALYSIS_BULK_MAX` affected posts (newest `published_at` first, without an open run, effective relevance not `irrelevant` — BR-016) get a new run `trigger=version_change` at the current effective version. `dryRun=true` returns the would-be `marked` count and changes nothing. Audit `analysis.bulk_reanalyze_requested` with `scope:"version_change"`, `filters:{ version }`, `counts:{ marked, enqueued, cap }`.

Run object: `{ id, postId, status, trigger, effectiveVersion, attemptCount, errorCode, errorMessage, startedAt, completedAt, createdAt }`.

### Analysis settings (P1, FR-190, T-151)

| Method & path                                  | Role   | Request                      | Response               | Errors                                                                                |
| ---------------------------------------------- | ------ | ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `GET /projects/:projectId/settings/analysis`   | member | —                            | `200 AnalysisSettings` | 403 `FORBIDDEN_PROJECT`                                                               |
| `PATCH /projects/:projectId/settings/analysis` | admin  | `UpdateAnalysisSettingsBody` | `200 AnalysisSettings` | 400 `VALIDATION_ERROR` (`details.issues`), 403 `FORBIDDEN_ROLE` / `FORBIDDEN_PROJECT` |

`AnalysisSettings`: `{ policyVersion:"safety-policy-v2", version:2, isDefault:false, confidenceBands:{high,medium}, safetyThresholds:{<category>:{sensitive,severe}} (all 13), versions:{7 fields}, effectiveVersion, outdatedCount, createdAt|null, createdBy:{id,displayName,email}|null }`. `isDefault:true` (version 1, no row) means the v1 constants. `outdatedCount` = posts whose current analysis has another `safety_policy_version`.

`UpdateAnalysisSettingsBody`: `{ confidenceBands?: {high, medium}, safetyThresholds?: {<category>?: {sensitive, severe}} }`, at least one key. Values step 0.01 in [0.01, 1]; `medium < high`; per category not both `null`, and `sensitive < severe` when both set; unknown categories rejected.

PATCH behaviour: one transaction, project row locked `FOR UPDATE` (concurrent admins get consecutive versions). The body is merged into the active policy and the merged policy is re-validated. No change → `200` with the current settings, no row, no audit. Otherwise a new row `version+1` / `safety-policy-v{n}` is inserted and `analysis_settings.updated` is audited in the same transaction with `{ changes:{"confidenceBands.high"|"safetyThresholds.<cat>.<level>":{from,to}}, effectiveVersion }`. PATCH never stales or enqueues runs; re-analysis is optional and goes through FR-196 (T-145).

## 10. System status

### `GET /projects/:projectId/system-status`

```json
{
  "generatedAt": "…",
  "threads": {
    "status": "connected",
    "accountIdentifier": "eventista.official",
    "tokenExpiresAt": "…",
    "lastSuccessAt": "…",
    "lastError": null
  },
  "collector": {
    "status": "healthy|degraded|paused",
    "activeQueries": 4,
    "lastGlobalSyncAt": "…",
    "jobsInProgress": 1,
    "failedJobs24h": 0,
    "partialJobs24h": 1,
    "successRate24h": 0.97,
    "collectionLagSeconds": 420,
    "circuit": { "open": false, "until": null, "reason": null }
  },
  "analysis": {
    "status": "healthy|degraded|budget_paused",
    "pending": 61,
    "processing": 3,
    "failed24h": 3,
    "completed24h": 812,
    "analysisLagSeconds": 85,
    "versions": {
      "classifierProvider": "openai",
      "classifierModel": "<configured>",
      "promptVersion": "classifier-v1",
      "taxonomyVersion": "taxonomy-v1",
      "safetyProvider": "openai",
      "safetyModel": "omni-moderation-latest",
      "safetyPolicyVersion": "safety-policy-v1"
    },
    "tokens24h": { "input": 412000, "output": 61000 },
    "estimatedCost24hUsd": 0.83
  },
  "database": { "approxPosts": 128400, "approxAnalyses": 131200, "lastMigration": "20260910_init" }
}
```

## 11. Audit

`GET /projects/:projectId/audit-logs` (admin): `action?, actorUserId?, from, to, cursor, limit` → `{ items:[{id, action, actor:{id,displayName,email}, entityType, entityId, metadata, requestId, createdAt}], nextCursor, totalCount? }`.

- Sorted `createdAt desc, id desc` (keyset cursor). `from` inclusive, `to` exclusive (absolute UTC instants, range ≤ `MAX_RANGE_DAYS`). `count=true` adds `totalCount`. Always scoped to `:projectId`; `action` is exact match.
- `actor` is `null` when the user was deleted (`ON DELETE SET NULL`) or for system actions. Errors: 400 `VALIDATION_ERROR` (bad query/cursor), 403 `FORBIDDEN_ROLE` (analyst/viewer), 403 `FORBIDDEN_PROJECT` (non-member).

## 12. Health

`GET /health/live` → `{ status:"ok" }` · `GET /health/ready` → `{ status:"ok|degraded|error", checks:{ database:"up", threads:"up|unknown|down", classifier:"up|unknown|down" } }` (only `database` affects HTTP status).

## 13. Error codes

| Code                                                                                                                                              | HTTP      | When                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------- |
| `VALIDATION_ERROR`                                                                                                                                | 400       | Zod failure; `details.issues[]`                   |
| `QUERY_IMMUTABLE_FIELD`                                                                                                                           | 400       | patching `queryValue/queryType`                   |
| `BACKFILL_WINDOW_INVALID`                                                                                                                         | 400       | until ≤ since or > max days                       |
| `AUTH_MISSING_TOKEN` / `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED`                                                                                | 401       |                                                   |
| `FORBIDDEN_ROLE` / `FORBIDDEN_PROJECT`                                                                                                            | 403       |                                                   |
| `NOT_FOUND`                                                                                                                                       | 404       |                                                   |
| `QUERY_DUPLICATE` / `SYNC_ALREADY_RUNNING` / `LAST_ADMIN` / `MEMBER_EXISTS` / `ANALYSIS_ALREADY_PENDING`                                          | 409       |                                                   |
| `EXPORT_TOO_LARGE`                                                                                                                                | 413       |                                                   |
| `RATE_LIMITED`                                                                                                                                    | 429       | internal throttling                               |
| `THREADS_UNAUTHORIZED` / `THREADS_FORBIDDEN`                                                                                                      | 502       | surfaced on verify; jobs store code               |
| `THREADS_RATE_LIMITED` / `THREADS_UPSTREAM_ERROR` / `THREADS_TIMEOUT` / `THREADS_MALFORMED_RESPONSE`                                              | 503 / 502 |                                                   |
| `INTEGRATION_NOT_CONFIGURED`                                                                                                                      | 409       | run/verify without token                          |
| `INTERNAL`                                                                                                                                        | 500       | never leaks stack                                 |
| `ANALYSIS_PROVIDER_ERROR` (retryable: 429/5xx/timeout/network) / `ANALYSIS_PROVIDER_AUTH` (401/403) / `ANALYSIS_PROVIDER_BAD_REQUEST` (other 4xx) | 502       | run `error_code` only (T-071)                     |
| `ANALYSIS_SCHEMA_INVALID`                                                                                                                         | 500       | provider response shape invalid; run `error_code` |

## 14. Versioning & compatibility

Additive changes (new optional fields/params) are allowed in v1. Removing/renaming fields, changing semantics of metrics (see `metricsVersion`) or enums → new major path. Contracts are unit-tested with snapshot fixtures in `packages/contracts`.
