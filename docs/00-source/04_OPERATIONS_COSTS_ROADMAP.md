# 04 — Operations, Costs, Roadmap and Risks

## 1. Cost summary

### 1.1 Threads API

For the official Threads API documentation reviewed for this requirements pack, Meta exposes authentication, permissions and API functionality but does not publish a simple per-request billing table comparable to X's pay-per-read model.

Planning assumption for MVP:

```text
Direct Threads API usage fee: $0 in the current estimate
```

Important:
- This is **not** a guarantee that Meta will never introduce fees.
- API access, permissions, App Review, rate limits and provider policies are still constraints.
- Re-check Meta documentation immediately before production launch.

### 1.2 Supabase

Current checked Supabase Pro plan:

```text
$25/month
```

Includes, among other plan quotas:
- 8 GB general-purpose disk per project before disk overage
- 250 GB egress
- daily backups
- included compute credit sufficient for one Micro instance under current pricing presentation

Current general-purpose disk overage:
```text
$0.125 / GB / month
```

Free plan currently includes:
```text
500 MB database size per project
```

Recommendation:
- POC/local: Free can be enough.
- Staging/production MVP: budget Pro.
- Use separate production environment.

### 1.3 OpenAI Moderation

`omni-moderation-latest` is currently documented as a free moderation model.

Use this for:
- safety category detection
- safety category scores

The product's `safe/sensitive/severe` mapping remains an internal policy layer.

### 1.4 LLM classifier

Cost depends on the selected model.

Use formula:

```text
monthly_input_tokens
= analyzed_posts × average_input_tokens_per_post

monthly_output_tokens
= analyzed_posts × average_output_tokens_per_post

monthly_cost
= input_cost + output_cost
```

Important optimization:
- dedupe
- relevance gate
- version cache
- no repeated analysis for unchanged post/model version
- concise structured output

Do not finalize AI cost until a POC measures:
- average post length
- prompt overhead
- output size
- relevant percentage
- posts/month

### 1.5 Hosting

Not finalized.

Cost items:
- Next.js hosting
- NestJS API
- persistent/scheduled worker
- logs/monitoring
- secret manager
- optional Redis only if introduced later

MVP architecture intentionally avoids Kafka/Redis/OpenSearch unless measured scale requires them.

---

## 2. Database capacity planning

A rough planning range for one normalized mention plus analysis is often single-digit KB, but actual Postgres growth must be measured.

Illustrative rough planning only:

| Posts | Approx logical data/index planning range |
|---:|---:|
| 10,000 | tens to low hundreds of MB |
| 100,000 | hundreds of MB to ~1 GB |
| 1,000,000 | several GB |
| 10,000,000 | tens of GB |

This is deliberately a range because:
- raw JSON varies
- analysis history adds rows
- indexes add storage
- WAL/system disk usage is separate
- long text/media metadata vary

Do not store image/video binaries.

---

## 3. Recommended retention

Initial planning default:

```text
Posts + current/history analysis: 12 months
Sync operational jobs: 180 days
Detailed application logs: 30–90 days
Audit logs: 12+ months if organizationally required
Aggregates: longer-term
```

All retention must be configurable.

Before launch:
- verify Meta platform/data terms
- add purge operation
- document deletion workflow

---

## 4. Threads API POC — mandatory before full UI build

The single highest product risk is source-data availability.

Run this POC before investing heavily in final dashboard polish.

### 4.1 POC checklist

Meta setup:
- Create Meta app with Threads use case.
- Configure OAuth.
- Obtain necessary scopes.
- Verify App Review requirements.
- Obtain long-lived token behavior.
- Verify refresh behavior.

Search tests:
- search `1zone` KEYWORD RECENT
- search `eventista` KEYWORD RECENT
- search `1zone` TAG RECENT
- search `eventista` TAG RECENT
- test TOP
- test `since` / `until`
- test pagination
- test empty result
- test Unicode/Vietnamese query

Measure:
- number of results
- max practical pages
- latency
- lag from post time to discovery
- duplicate behavior across polls
- duplicate behavior across query types
- historical coverage actually returned
- available fields
- rate-limit behavior
- token/permission errors
- deleted/unavailable content behavior where reproducible

Reply tests:
- test `has_replies`
- test reply endpoint with posts owned by authenticated account
- test allowed behavior for discovered third-party posts
- document exactly what App Review permits

### 4.2 POC exit criteria

Do not freeze ingestion requirements until:
- keyword search works with production-intended permission path
- pagination is understood
- rate limiting is measurable
- query/result quality is acceptable
- at least one reliable backfill strategy is documented
- third-party replies limitation is explicitly documented

---

## 5. MVP delivery roadmap

## Phase 0 — POC

Deliver:
- Meta app
- auth/token
- simple NestJS Threads client
- keyword search
- pagination
- raw fixture capture
- rate-limit/error notes
- POC report

No polished UI needed.

---

## Phase 1 — Foundation

Deliver:
- repository/apps
- Supabase environments
- auth
- project/RBAC
- migrations
- listening query CRUD
- collector
- sync jobs
- dedupe
- raw/normalized storage
- system health

Exit:
- scheduled sync runs safely for several days
- duplicate rate is understood
- failures are visible

---

## Phase 2 — Analysis

Deliver:
- relevance
- moderation
- sentiment
- intent
- topic
- language
- summary
- strict schema validation
- analysis versioning
- retry/failure states

Exit:
- evaluation dataset tested
- unacceptable classifications identified
- prompt/taxonomy v1 frozen

---

## Phase 3 — Dashboard MVP

Deliver:
- Overview
- 6 charts
- filters
- comparison period
- Mentions Explorer
- Mention detail
- Listening Queries
- System Status

Exit:
- every KPI drill-down can be reconciled with underlying posts
- no known denominator mismatch

---

## Phase 4 — Analyst workflow

P1:
- CSV
- manual override
- review queue
- bulk re-analysis
- backfill UI
- topic × sentiment
- negative contributor analysis

---

## Phase 5 — Intelligence

P2:
- spike detection
- alerts
- saved views
- scheduled report
- X integration
- competitor/project comparisons

---

## 6. Suggested MVP screens

### 6.1 Overview
P0.

### 6.2 Mentions Explorer
P0.

### 6.3 Mention Detail
P0.

### 6.4 Listening Queries
P0.

### 6.5 System Status
P0.

### 6.6 Settings / Threads Integration
P0.

### 6.7 Reviews
P1.

---

## 7. Risks

### Risk 1 — Threads data availability
Severity: High.

Mitigation:
- API POC first.
- no promise beyond verified official access.
- persist data for historical analytics once collected.

### Risk 2 — Search false positives
Severity: High for short generic terms.

Example:
`1zone`.

Mitigation:
- relevance classifier
- exclusions
- analyst review
- query quality metrics

### Risk 3 — Sentiment quality in Vietnamese slang/sarcasm
Severity: Medium/High.

Mitigation:
- Vietnamese evaluation dataset
- manual override
- low-confidence review
- prompt/model versioning

### Risk 4 — Misinterpreting safety as sentiment
Severity: High product-semantic risk.

Mitigation:
- separate dimensions
- separate charts
- documented metric definitions

### Risk 5 — LLM taxonomy drift
Severity: Medium.

Mitigation:
- strict JSON schema
- enum validation
- taxonomy version
- re-analysis

### Risk 6 — Duplicate analytics
Severity: High.

Cause:
one post matches multiple queries.

Mitigation:
- single `social_posts` row
- join table
- distinct post counting in all-query totals

### Risk 7 — Multiple scheduler instances
Severity: Medium.

Mitigation:
- DB job claim/distributed lock
- idempotent collector

### Risk 8 — Expired/revoked Threads token
Severity: High operationally.

Mitigation:
- connection status
- refresh support
- explicit alert/status
- secure token rotation

### Risk 9 — Supabase growth
Severity: Low initially.

Mitigation:
- no media binary
- retention
- indexes based on query plans
- aggregate tables later
- monitor disk

### Risk 10 — Compliance/platform changes
Severity: Medium/High.

Mitigation:
- official API only
- provider adapter
- retention/purge
- launch-time terms review

---

## 8. Security checklist

- [ ] Supabase service-role key not exposed to FE.
- [ ] Threads token not exposed to FE.
- [ ] OpenAI key not exposed to FE.
- [ ] Secrets excluded from logs.
- [ ] RBAC checked server-side.
- [ ] Admin mutations audited.
- [ ] Input validation on all filters/body.
- [ ] Rate limit internal admin actions such as bulk re-analysis.
- [ ] CSRF/session strategy reviewed for chosen auth flow.
- [ ] Content rendered as text; sanitize any rich content.
- [ ] External links use safe target/rel behavior.
- [ ] Production CORS restricted.
- [ ] Separate staging/prod secrets.
- [ ] Database backups verified.
- [ ] Purge workflow tested.

---

## 9. Observability launch checklist

- [ ] Collector success rate dashboard.
- [ ] Last successful sync visible.
- [ ] Per-query last success/error.
- [ ] Analysis queue size.
- [ ] Analysis failure count.
- [ ] API p95.
- [ ] DB usage.
- [ ] Provider rate-limit events.
- [ ] Token expiry/connection state.
- [ ] Request IDs in logs.
- [ ] Job IDs in logs.

---

## 10. Analytics QA checklist

For a sample date range:

- [ ] dashboard total equals distinct relevant posts
- [ ] query drill-down counts duplicate-cross-query behavior correctly
- [ ] positive + neutral + negative equals sentiment-analyzed count
- [ ] safety denominator excludes pending analysis
- [ ] intent percentages allowed to exceed 100% total
- [ ] topic percentages allowed to exceed 100% total
- [ ] previous-period boundary is correct in project timezone
- [ ] irrelevant posts excluded by default
- [ ] manual overrides affect effective analytics
- [ ] re-analysis does not duplicate posts

---

## 11. Initial technical decisions to freeze

Recommended decisions:

```text
Platform                Threads only
Frontend                Next.js + TypeScript
UI                      Tailwind + Untitled UI
Backend                 NestJS
Database                Supabase Postgres
Auth                    Supabase Auth
API style               REST
Scheduler               NestJS worker + DB locking
Poll interval           configurable; default 10 min
Overlap                  configurable; default 20 min
DB timezone              UTC
UI timezone              Asia/Ho_Chi_Minh default
Media binary storage     no
Safety provider          OpenAI Moderation initial
Classifier provider      abstracted/configurable
Search engine            Postgres first
Queue infra              Postgres/job state first
Kafka                    no
Redis                    no unless later required
OpenSearch               no unless later required
```

---

## 12. Estimated starting monthly infrastructure budget

Without choosing hosting and paid classifier model, an honest initial estimate is:

```text
Threads API direct usage       currently no published per-request fee found
Supabase production            ~$25/month starting point
Moderation                     $0 model usage for OpenAI moderation
Classifier                     usage-dependent
Next.js/NestJS hosting          TBD
Monitoring/logging             TBD / may fit hosting free quotas initially
```

The practical cost driver at MVP scale is more likely engineering + application hosting + classifier usage than database storage.

---

## 13. Reference snapshot

Checked 2026-09-05.

### Threads
Meta Postman collection:
https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api

Search request:
https://www.postman.com/meta/threads/request/m9j4i2x/search-for-threads-posts

### Supabase
Pricing:
https://supabase.com/pricing

Billing:
https://supabase.com/docs/guides/platform/billing-on-supabase

Disk:
https://supabase.com/docs/guides/platform/manage-your-usage/disk-size

### Untitled UI
Next.js integration:
https://www.untitledui.com/react/integrations/nextjs

React docs:
https://www.untitledui.com/react/docs/introduction

### OpenAI Moderation
https://platform.openai.com/docs/api-reference/moderations
https://developers.openai.com/api/docs/models/omni-moderation-latest
