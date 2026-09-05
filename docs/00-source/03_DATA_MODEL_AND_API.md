# 03 — Data Model and API Contract

## 1. Data modeling principles

1. Persist historical social data.
2. Keep provider source identity stable.
3. Separate posts from query matches.
4. Separate source content from analysis.
5. Make analysis versionable.
6. Normalize high-cardinality/filterable dimensions.
7. Use JSONB for provider-specific or score maps, not for everything.
8. Use `project_id` throughout.
9. Soft-delete configuration records where auditability matters.
10. Use UUIDs internally; keep provider IDs as strings.

---

## 2. Core enums

### Platform

```text
threads
```

Future:
```text
x
reddit
...
```

### QueryType

```text
keyword
topic_tag
```

### SearchType

```text
RECENT
TOP
```

### RelevanceLabel

```text
relevant
uncertain
irrelevant
```

### SentimentLabel

```text
positive
neutral
negative
```

### SafetyLevel

```text
safe
sensitive
severe
```

### AnalysisStatus

```text
pending
processing
completed
failed
skipped
stale
```

### JobStatus

```text
queued
running
success
partial
failed
cancelled
```

### UserRole

```text
admin
analyst
viewer
```

---

## 3. Database tables

## 3.1 `monitoring_projects`

Purpose:
Logical listening scope.

Columns:

```text
id uuid pk
name text not null
slug text unique not null
description text null
timezone text not null default 'Asia/Ho_Chi_Minh'
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

Seed:
```text
1Zone / Eventista Social Listening
```

---

## 3.2 `user_profiles`

Maps Supabase Auth user to product profile.

```text
id uuid pk                # same as auth.users.id where possible
display_name text null
email text not null
created_at timestamptz
updated_at timestamptz
```

---

## 3.3 `project_members`

```text
project_id uuid fk
user_id uuid fk
role user_role not null
created_at timestamptz

primary key(project_id, user_id)
```

---

## 3.4 `integration_connections`

Purpose:
Connection metadata only.

```text
id uuid pk
project_id uuid fk
platform platform not null
status text not null
account_identifier text null
granted_scopes text[] null
token_expires_at timestamptz null
last_verified_at timestamptz null
last_success_at timestamptz null
last_error_code text null
last_error_message text null
created_at timestamptz
updated_at timestamptz
```

Do not store raw unencrypted token in a normal text column.

Token must live in:
- managed secret store; or
- encrypted server-side storage with a proper encryption key strategy.

---

## 3.5 `listening_queries`

```text
id uuid pk
project_id uuid fk not null
platform platform not null default 'threads'
display_name text not null
query_value text not null
query_type query_type not null
search_mode text not null               # KEYWORD | TAG
scheduled_search_type text not null default 'RECENT'
enabled boolean not null default true

exclude_terms text[] not null default '{}'
include_terms text[] not null default '{}'

poll_interval_seconds integer not null default 600
overlap_seconds integer not null default 1200

last_successful_sync_at timestamptz null
next_run_at timestamptz null
last_error_at timestamptz null
last_error_message text null

created_by uuid null
created_at timestamptz
updated_at timestamptz
deleted_at timestamptz null
```

Constraint recommendation:

```text
UNIQUE(project_id, platform, query_type, lower(query_value))
WHERE deleted_at IS NULL
```

---

## 3.6 `social_posts`

```text
id uuid pk

project_id uuid fk not null
platform platform not null
platform_post_id text not null

username text null
owner_id text null

text text null
permalink text null
shortcode text null

media_type text null
media_url text null
thumbnail_url text null
alt_text text null
link_attachment_url text null

is_quote_post boolean null
has_replies boolean null
quoted_post_id text null
reposted_post_id text null

published_at timestamptz not null

content_hash text not null
revision integer not null default 1

raw_data jsonb null

first_seen_at timestamptz not null
last_seen_at timestamptz not null

created_at timestamptz
updated_at timestamptz
```

Unique:

```text
UNIQUE(platform, platform_post_id)
```

If future tenants must store independent copies/policies, reassess whether project_id belongs in this uniqueness constraint. For the current internal product, a global source post identity is preferable.

---

## 3.7 `post_query_matches`

Many-to-many relationship.

```text
post_id uuid fk
query_id uuid fk

first_matched_at timestamptz not null
last_matched_at timestamptz not null

primary key(post_id, query_id)
```

---

## 3.8 `analysis_runs`

Represents a versioned analysis execution.

```text
id uuid pk
post_id uuid fk not null

status analysis_status not null

classifier_provider text null
classifier_model text null
prompt_version text null
taxonomy_version text null

safety_provider text null
safety_model text null
safety_policy_version text null

source_content_hash text not null

started_at timestamptz null
completed_at timestamptz null

input_tokens integer null
output_tokens integer null
estimated_cost_usd numeric(12,6) null

attempt_count integer not null default 0
error_code text null
error_message text null

created_at timestamptz
```

Indexes:
- post_id, created_at desc
- status
- source_content_hash

---

## 3.9 `post_analyses`

One finalized result per `analysis_run`.

```text
id uuid pk
analysis_run_id uuid unique fk
post_id uuid fk not null

relevance_label relevance_label null
relevance_confidence numeric(5,4) null
relevance_explanation text null

sentiment_label sentiment_label null
sentiment_confidence numeric(5,4) null

safety_level safety_level null
safety_flagged boolean null
safety_category_scores jsonb null

language_code text null

summary text null

overall_model_confidence numeric(5,4) null

created_at timestamptz
```

For dashboard performance, the application can additionally maintain `current_analysis_id` on `social_posts` or a separate pointer table/view.

Recommended:

```text
social_posts.current_analysis_id uuid null
```

only after ensuring transaction consistency.

---

## 3.10 `analysis_intents`

```text
analysis_id uuid fk
label text not null
confidence numeric(5,4) null

primary key(analysis_id, label)
```

Initial labels:
- praise
- complaint
- question
- recommendation
- purchase_intent
- boycott
- spam
- information
- support_request
- comparison
- other

---

## 3.11 `analysis_topics`

```text
analysis_id uuid fk
label text not null
confidence numeric(5,4) null

primary key(analysis_id, label)
```

Initial labels:
- artist
- ticket
- venue
- price
- performance
- membership
- payment
- queue
- customer_service
- event
- merchandise
- other

---

## 3.12 `analysis_overrides`

Recommended P1.

```text
id uuid pk
post_id uuid fk not null
analysis_id uuid fk null
field text not null
previous_value jsonb null
override_value jsonb not null
reason text null
reviewed_by uuid not null
created_at timestamptz not null
revoked_at timestamptz null
```

Effective-value logic:
- active override wins
- otherwise latest valid AI analysis

---

## 3.13 `sync_jobs`

```text
id uuid pk
project_id uuid fk
query_id uuid fk

status job_status not null

search_type text not null
search_mode text not null
window_since timestamptz null
window_until timestamptz null

started_at timestamptz null
completed_at timestamptz null

pages_fetched integer not null default 0
records_fetched integer not null default 0
records_inserted integer not null default 0
records_updated integer not null default 0
records_duplicated integer not null default 0
records_invalid integer not null default 0

provider_requests integer not null default 0
rate_limit_events integer not null default 0

last_cursor text null

error_code text null
error_message text null

created_at timestamptz
```

---

## 3.14 `audit_logs`

```text
id uuid pk
project_id uuid null
actor_user_id uuid null
action text not null
entity_type text null
entity_id text null
metadata jsonb null
created_at timestamptz
```

Do not store secrets in audit metadata.

---

## 3.15 `analytics_hourly` / `analytics_daily`

P1.5 optimization.

Possible fields:

```text
bucket_start timestamptz
project_id uuid
query_id uuid null

relevant_mentions integer
positive_count integer
neutral_count integer
negative_count integer

safe_count integer
sensitive_count integer
severe_count integer

complaint_count integer
purchase_intent_count integer
...

primary key(...)
```

Do not create one row for every possible combination of every dimension unless required.

---

## 4. Index recommendations

### `social_posts`

```text
(platform, platform_post_id) UNIQUE
(project_id, published_at DESC)
(project_id, first_seen_at DESC)
(project_id, current_analysis_id)
```

Full-text:
- generated `tsvector` over `text`
- GIN index when Mentions search volume justifies it

### `listening_queries`

```text
(project_id, enabled, next_run_at)
```

### `post_query_matches`

```text
(query_id, post_id)
(post_id, query_id) PK
```

### `post_analyses`

```text
(post_id)
(relevance_label)
(sentiment_label)
(safety_level)
(language_code)
```

Composite indexes should be added based on real dashboard query plans rather than creating all combinations in advance.

### Join labels

```text
analysis_intents(label, analysis_id)
analysis_topics(label, analysis_id)
```

---

## 5. Data size notes

Do not estimate database size using text length alone.

Storage includes:
- table rows
- JSONB
- indexes
- WAL/system usage
- aggregates

For planning, a social mention with normalized metadata + analysis may commonly land in the single-digit KB range, but measure the real schema after the POC.

At 1M posts, indexes and analysis history can matter as much as source text.

Add a production metric:
```text
average_storage_bytes_per_post
```
from sampled/observed DB growth.

---

## 6. API conventions

Base:
```text
/api/v1
```

JSON:
```text
application/json
```

Auth:
```text
Authorization: Bearer <Supabase JWT>
```

Pagination:
Prefer cursor pagination for Mentions.

Dates:
ISO-8601.

Errors:

```json
{
  "error": {
    "code": "THREADS_RATE_LIMITED",
    "message": "Threads API rate limit reached.",
    "requestId": "..."
  }
}
```

Do not return internal stack traces in production.

---

## 7. API — Auth/User

### `GET /api/v1/me`

Response:

```json
{
  "id": "uuid",
  "email": "analyst@example.com",
  "displayName": "Analyst",
  "projects": [
    {
      "id": "uuid",
      "name": "1Zone / Eventista Social Listening",
      "role": "analyst"
    }
  ]
}
```

---

## 8. API — Projects

### `GET /api/v1/projects`

List projects available to current user.

### `GET /api/v1/projects/:projectId`

Get project config.

### `PATCH /api/v1/projects/:projectId`

Admin only.

Allowed initial settings:
- name
- timezone

---

## 9. API — Listening queries

### `GET /api/v1/projects/:projectId/listening-queries`

Query params:
- enabled
- type
- page/cursor

### `POST /api/v1/projects/:projectId/listening-queries`

```json
{
  "displayName": "Eventista",
  "queryValue": "eventista",
  "queryType": "keyword",
  "excludeTerms": [],
  "pollIntervalSeconds": 600,
  "overlapSeconds": 1200,
  "enabled": true
}
```

### `PATCH /api/v1/projects/:projectId/listening-queries/:id`

Admin.

### `DELETE /api/v1/projects/:projectId/listening-queries/:id`

Soft delete.

### `POST /api/v1/projects/:projectId/listening-queries/:id/run`

Manual sync now.

Response:
```json
{
  "jobId": "uuid",
  "status": "queued"
}
```

### `POST /api/v1/projects/:projectId/listening-queries/:id/backfill`

P1.

```json
{
  "since": "2026-08-01T00:00:00Z",
  "until": "2026-09-01T00:00:00Z"
}
```

Server validates provider-supported ranges.

---

## 10. API — Dashboard

### `GET /api/v1/projects/:projectId/analytics/overview`

Query:

```text
from
to
timezone
queryIds[]
sentiment[]
safety[]
intent[]
topic[]
language[]
relevance[]
compare=true|false
```

Response:

```json
{
  "range": {
    "from": "2026-09-04T00:00:00Z",
    "to": "2026-09-05T00:00:00Z",
    "timezone": "Asia/Ho_Chi_Minh"
  },
  "coverage": {
    "relevantMentions": 2481,
    "analyzedMentions": 2410,
    "pendingMentions": 61,
    "failedMentions": 10
  },
  "kpis": {
    "mentionCount": 2481,
    "mentionGrowthPct": 21.4,
    "positiveRate": 0.62,
    "negativeRate": 0.18,
    "safetyRiskRate": 0.032,
    "complaintRate": 0.28
  }
}
```

### `GET /api/v1/projects/:projectId/analytics/mentions-timeseries`

Response:

```json
{
  "interval": "hour",
  "data": [
    {
      "time": "2026-09-05T01:00:00+07:00",
      "mentions": 42
    }
  ]
}
```

### `GET /api/v1/projects/:projectId/analytics/sentiment`

Return:
- distribution
- optional timeseries

### `GET /api/v1/projects/:projectId/analytics/safety`

### `GET /api/v1/projects/:projectId/analytics/intents`

### `GET /api/v1/projects/:projectId/analytics/topics`

### `GET /api/v1/projects/:projectId/analytics/languages`

P1.

Use one consolidated analytics endpoint instead of many endpoints if implementation/testing shows it is simpler. The important requirement is a stable typed contract.

---

## 11. API — Mentions

### `GET /api/v1/projects/:projectId/mentions`

Filters:

```text
from
to
queryIds[]
q
relevance[]
sentiment[]
safety[]
intent[]
topic[]
language[]
analysisStatus[]
reviewStatus[]
sort
cursor
limit
```

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "platform": "threads",
      "platformPostId": "...",
      "username": "...",
      "text": "...",
      "permalink": "...",
      "publishedAt": "...",
      "matchedQueries": [
        {"id": "uuid", "name": "Eventista"}
      ],
      "analysis": {
        "status": "completed",
        "relevance": {
          "label": "relevant",
          "confidence": 0.97
        },
        "sentiment": {
          "label": "negative",
          "confidence": 0.91
        },
        "safety": {
          "level": "safe"
        },
        "intents": [
          {"label": "complaint", "confidence": 0.95}
        ],
        "topics": [
          {"label": "ticket", "confidence": 0.98},
          {"label": "price", "confidence": 0.96}
        ],
        "language": "vi",
        "summary": "User complains that ticket prices are high."
      }
    }
  ],
  "nextCursor": "..."
}
```

### `GET /api/v1/projects/:projectId/mentions/:id`

Full detail including:
- source metadata
- query matches
- current analysis
- safety category scores
- version metadata
- review/override history where permitted

### `POST /api/v1/projects/:projectId/mentions/:id/reanalyze`

Admin; optionally Analyst.

### `POST /api/v1/projects/:projectId/mentions/reanalyze`

P1 bulk operation with filter/body.

Must cap/batch to prevent accidental huge cost.

---

## 12. API — Review/override

P1.

### `POST /api/v1/projects/:projectId/mentions/:id/overrides`

```json
{
  "field": "sentiment",
  "value": "neutral",
  "reason": "Sarcastic context was misclassified."
}
```

### `DELETE /api/v1/projects/:projectId/mentions/:id/overrides/:overrideId`

Revoke override; keep history.

---

## 13. API — Sync jobs

### `GET /api/v1/projects/:projectId/sync-jobs`

Filters:
- query
- status
- date

### `GET /api/v1/projects/:projectId/sync-jobs/:id`

Include:
- time window
- pages
- fetched
- inserted
- duplicate
- errors
- provider requests

---

## 14. API — System status

### `GET /api/v1/projects/:projectId/system-status`

Example:

```json
{
  "threads": {
    "status": "connected",
    "lastSuccessAt": "...",
    "lastError": null
  },
  "collector": {
    "status": "healthy",
    "lastGlobalSyncAt": "...",
    "failedJobs24h": 0,
    "collectionLagSeconds": 420
  },
  "analysis": {
    "pending": 61,
    "failed24h": 3,
    "analysisLagSeconds": 85,
    "version": {
      "prompt": "classifier-v1",
      "taxonomy": "taxonomy-v1"
    }
  }
}
```

---

## 15. API — Export

P1.

### `GET /api/v1/projects/:projectId/mentions/export.csv`

Uses the same filters as mentions list.

For initial synchronous implementation:
- hard cap result count
- return clear error when export exceeds cap

Later:
```text
POST /exports
GET /exports/:id
```

---

## 16. Classification JSON schema

Conceptual schema:

```json
{
  "type": "object",
  "required": [
    "relevance",
    "sentiment",
    "intents",
    "topics",
    "language",
    "summary"
  ],
  "properties": {
    "relevance": {
      "type": "object",
      "required": ["label", "confidence"],
      "properties": {
        "label": {
          "enum": ["relevant", "uncertain", "irrelevant"]
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "explanation": {
          "type": "string"
        }
      }
    },
    "sentiment": {
      "type": "object",
      "required": ["label", "confidence"],
      "properties": {
        "label": {
          "enum": ["positive", "neutral", "negative"]
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    },
    "intents": {
      "type": "array"
    },
    "topics": {
      "type": "array"
    },
    "language": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  }
}
```

Server must validate and reject unknown labels unless an explicit taxonomy migration permits them.

---

## 17. Safety policy mapping

Keep provider result and business level separate.

Concept:

```ts
type SafetyProviderResult = {
  flagged: boolean;
  categoryScores: Record<string, number>;
};

type SafetyPolicyResult = {
  level: "safe" | "sensitive" | "severe";
  policyVersion: string;
};
```

Policy rules are product decisions.

Example initial approach:
- `safe`: no meaningful provider category crosses configured policy threshold
- `sensitive`: potentially harmful/harassing/sexual/violent/etc. content requiring analyst attention
- `severe`: highest-risk categories or scores according to policy

Do not hard-code the first threshold forever.
Persist `safety_policy_version`.

---

## 18. Effective analysis view

To simplify application queries, create a database view or service projection:

```text
effective_post_analysis
```

It returns:
- latest valid AI analysis
- overlaid manual overrides

This keeps dashboard/business code from repeatedly implementing override logic.

---

## 19. Analytics SQL semantics

### Distinctness

For project-wide totals:
```text
COUNT(DISTINCT post.id)
```

Do not count the same post twice because it matched multiple queries.

For query-specific breakdown:
each post can count once for each matched query.

### Intent/topic

Because labels are many-to-many:
- use `COUNT(DISTINCT post_id)`
- avoid inflating totals when joining both intent and topic tables simultaneously

Use subqueries/CTEs or pre-aggregated label relations.

---

## 20. Migration strategy

Use migration files checked into source control.

Rules:
- no manual production schema edits without migration
- backwards-compatible API changes where possible
- taxonomy changes require `taxonomy_version`
- destructive retention/purge migrations require backup/approval

Seed migrations:
- project
- initial roles if needed
- default queries
- initial taxonomy version
