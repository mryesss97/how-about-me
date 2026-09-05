# 05 · REST API Contract (v1)

| Field  | Value                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Status | Approved (baseline v1.0) — changes are additive within v1; breaking → `/api/v2`                                             |
| Source | [00-source/03_DATA_MODEL_AND_API.md](../00-source/03_DATA_MODEL_AND_API.md) §6–§15                                          |
| Code   | `packages/contracts/src/**` (Zod schemas = the contract), `apps/api/src/modules/**/*.controller.ts`, OpenAPI at `/api/docs` |

## 1. Conventions

| Item            | Rule                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Base            | `/api/v1`                                                                                                                        |
| Content         | `application/json; charset=utf-8`                                                                                                |
| Auth            | `Authorization: Bearer <Supabase access JWT>`; `/health/*` public                                                                |
| IDs             | UUID strings; provider ids as strings                                                                                            |
| Dates           | ISO-8601 with offset (`2026-09-05T01:00:00+07:00`) or `Z`; responses UTC `Z` unless bucketed (then in requested tz)              |
| Arrays in query | repeat key `sentiment=positive&sentiment=negative` (also accepts comma list)                                                     |
| Pagination      | cursor: `?cursor=<opaque>&limit=25` → `{ items, nextCursor, totalCount? }`; `count=true` adds `totalCount` (bounded cost)        |
| Errors          | `{ "error": { "code": "QUERY_DUPLICATE", "message": "…", "requestId": "…", "details"?: {...} } }`                                |
| Rate limit      | `429 RATE_LIMITED` with `Retry-After`                                                                                            |
| Request id      | `x-request-id` echoed                                                                                                            |
| Roles           | see permission matrix [../01-product/02-personas-rbac.md](../01-product/02-personas-rbac.md#3-permission-matrix-server-enforced) |

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
| `POST /projects/:projectId/members`           | admin  | `{ email, role }`                                                                 | `Member` (201)                                       |
| `PATCH /projects/:projectId/members/:userId`  | admin  | `{ role }`                                                                        | `Member` · `409 LAST_ADMIN`                          |
| `DELETE /projects/:projectId/members/:userId` | admin  | —                                                                                 | 204 · `409 LAST_ADMIN`                               |

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

## 6. Analytics

Common query params (all optional): `from`, `to` (defaults last 7 d), `timezone` (default project tz), `queryIds[]`, `relevance[]` (default `relevant`), `sentiment[]`, `safety[]`, `intent[]`, `topic[]`, `language[]`, `analysisStatus[]`, `compare=false`, `timeField=published_at`.

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

### `GET …/analytics/mentions-timeseries`

```json
{
  "interval": "hour",
  "timezone": "Asia/Ho_Chi_Minh",
  "data": [{ "time": "2026-09-05T01:00:00+07:00", "mentions": 42, "previous": 37 }]
}
```

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

### `GET …/analytics/safety` → `{ denominator, distribution:[{label:"safe"|"sensitive"|"severe",count,share}] }`

### `GET …/analytics/intents` → `{ denominator, distribution:[{label,count,share}] }` (all labels)

### `GET …/analytics/topics` → `{ denominator, distribution:[{label,count,share}] }` (top 12 + other)

### `GET …/analytics/languages` (P1) → same shape

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
      "matchedQueries": [{ "id": "uuid", "displayName": "Eventista", "queryType": "keyword" }],
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

### `GET /projects/:projectId/mentions/:id`

Adds: `ownerId, shortcode, mediaUrl, altText, linkAttachmentUrl, quotedPostId, repostedPostId, firstSeenAt, lastSeenAt, revision, contentHash`, `analysis.safety.categoryScores`, `analysis.relevance.explanation`, `analysis.versions {classifierProvider, classifierModel, promptVersion, taxonomyVersion, safetyProvider, safetyModel, safetyPolicyVersion}`, `analysis.analyzedAt`, `analysis.tokens {input, output}, estimatedCostUsd`, `runs:[{id,status,trigger,effectiveVersion,createdAt,completedAt,errorCode}]`, `overrides:[…]` (P1).

| Method & path                                 | Role                          | Notes                                                                               |
| --------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| `POST …/mentions/:id/reanalyze`               | admin · analyst⚙️             | → `202 { runId, status:"pending" }` · `409 ANALYSIS_ALREADY_PENDING`                |
| `POST …/mentions/reanalyze`                   | admin (P1)                    | body = list filters + `{ dryRun?: boolean }` → `{ matched, enqueued, cap }` · `429` |
| `POST …/mentions/:id/overrides`               | admin, analyst (P1)           | `{ field, value, reason? }` → 201 override                                          |
| `DELETE …/mentions/:id/overrides/:overrideId` | admin, analyst (P1)           | revoke → 204                                                                        |
| `GET …/mentions/export.csv`                   | admin, analyst, viewer⚙️ (P1) | list filters; `413 EXPORT_TOO_LARGE {details:{cap}}`                                |

## 8. Sync jobs

| Method & path                | Role   | Notes                                                                       |
| ---------------------------- | ------ | --------------------------------------------------------------------------- |
| `GET …/sync-jobs`            | member | `queryId?, status[], trigger[], from, to, cursor, limit`                    |
| `GET …/sync-jobs/:id`        | member | full counters, window, cursor, error, provider usage                        |
| `POST …/sync-jobs/:id/retry` | admin  | for `failed`/`partial` → new job resuming from `last_cursor` when available |

Job object:

```json
{ "id":"uuid","queryId":"uuid","status":"partial","trigger":"scheduled","searchType":"RECENT","searchMode":"KEYWORD",
  "windowSince":"…","windowUntil":"…","startedAt":"…","completedAt":"…",
  "pagesFetched":3,"recordsFetched":120,"recordsInserted":15,"recordsUpdated":1,"recordsDuplicated":100,"recordsInvalid":4,"recordsExcluded":2,
  "providerRequests":3,"rateLimitEvents":1,"lastCursor":"…","error":{"code":"THREADS_RATE_LIMITED","message":"…"}|null }
```

## 9. Analysis runs (ops)

| Method & path                       | Role   | Notes                                                                    |
| ----------------------------------- | ------ | ------------------------------------------------------------------------ |
| `GET …/analysis-runs`               | member | `status[], from, to, cursor` (used by System Status → Analysis failures) |
| `POST …/analysis-runs/:id/retry`    | admin  | failed → pending                                                         |
| `POST …/analysis-runs/retry-failed` | admin  | `{ limit ≤ 500 }`                                                        |

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
    "pending": 61,
    "processing": 3,
    "failed24h": 3,
    "completed24h": 812,
    "analysisLagSeconds": 85,
    "versions": {
      "classifierProvider": "openai",
      "classifierModel": "<configured>",
      "prompt": "classifier-v1",
      "taxonomy": "taxonomy-v1",
      "safetyProvider": "openai",
      "safetyModel": "omni-moderation-latest",
      "safetyPolicy": "safety-policy-v1"
    },
    "tokens24h": { "input": 412000, "output": 61000 },
    "estimatedCost24hUsd": 0.83
  },
  "database": { "approxPosts": 128400, "approxAnalyses": 131200, "lastMigration": "20260910_init" }
}
```

## 11. Audit

`GET /projects/:projectId/audit-logs` (admin): `action?, actorUserId?, from, to, cursor, limit` → `{ items:[{id, action, actor:{id,displayName,email}, entityType, entityId, metadata, requestId, createdAt}], nextCursor }`.

## 12. Health

`GET /health/live` → `{ status:"ok" }` · `GET /health/ready` → `{ status:"ok|degraded|error", checks:{ database:"up", threads:"up|unknown|down", classifier:"up|unknown|down" } }` (only `database` affects HTTP status).

## 13. Error codes

| Code                                                                                                 | HTTP      | When                                |
| ---------------------------------------------------------------------------------------------------- | --------- | ----------------------------------- |
| `VALIDATION_ERROR`                                                                                   | 400       | Zod failure; `details.issues[]`     |
| `QUERY_IMMUTABLE_FIELD`                                                                              | 400       | patching `queryValue/queryType`     |
| `BACKFILL_WINDOW_INVALID`                                                                            | 400       | until ≤ since or > max days         |
| `AUTH_MISSING_TOKEN` / `AUTH_INVALID_TOKEN` / `AUTH_TOKEN_EXPIRED`                                   | 401       |                                     |
| `FORBIDDEN_ROLE` / `FORBIDDEN_PROJECT`                                                               | 403       |                                     |
| `NOT_FOUND`                                                                                          | 404       |                                     |
| `QUERY_DUPLICATE` / `SYNC_ALREADY_RUNNING` / `LAST_ADMIN` / `ANALYSIS_ALREADY_PENDING`               | 409       |                                     |
| `EXPORT_TOO_LARGE`                                                                                   | 413       |                                     |
| `RATE_LIMITED`                                                                                       | 429       | internal throttling                 |
| `THREADS_UNAUTHORIZED` / `THREADS_FORBIDDEN`                                                         | 502       | surfaced on verify; jobs store code |
| `THREADS_RATE_LIMITED` / `THREADS_UPSTREAM_ERROR` / `THREADS_TIMEOUT` / `THREADS_MALFORMED_RESPONSE` | 503 / 502 |                                     |
| `INTEGRATION_NOT_CONFIGURED`                                                                         | 409       | run/verify without token            |
| `INTERNAL`                                                                                           | 500       | never leaks stack                   |

## 14. Versioning & compatibility

Additive changes (new optional fields/params) are allowed in v1. Removing/renaming fields, changing semantics of metrics (see `metricsVersion`) or enums → new major path. Contracts are unit-tested with snapshot fixtures in `packages/contracts`.
