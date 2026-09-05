# 01 — Product Requirements

## 1. Product summary

Build an internal social-listening and content-intelligence product that continuously discovers public Threads content matching configured keywords/topic tags, stores the discovered content, analyzes it, and presents actionable analytics.

Initial default listening terms:

- `1zone`
- `#1zone`
- `eventista`
- `#eventista`

The product must answer questions such as:

- How many relevant mentions did 1Zone/Eventista receive in the last 24 hours, 7 days, or 30 days?
- Is sentiment becoming more positive or negative?
- Which topics contribute most to negative sentiment?
- Are sensitive or severe discussions increasing?
- Are complaints, questions, purchase intent, boycott intent, or spam increasing?
- Which individual mentions contributed to a spike?
- What are people talking about most: artist, ticket, price, venue, payment, performance, membership, queue, customer service, etc.?
- What language is being used?
- How has the current period changed versus the previous comparable period?

---

## 2. Product objectives

### 2.1 Primary objectives

1. Collect relevant public Threads content using official API access.
2. Persist historical data in Supabase.
3. Classify content into stable, queryable dimensions.
4. Make trends understandable through dashboard charts.
5. Allow analysts to inspect the original mention behind every aggregate metric.
6. Allow administrators to manage listening queries without code changes.
7. Support reliable re-analysis when prompts/models/taxonomies change.
8. Provide enough operational visibility to know whether “no data” is real or caused by a failed sync.

### 2.2 Secondary objectives

- Make the data model ready for additional brands/artists/events.
- Prepare the architecture for a future X integration.
- Prepare the architecture for alerts and spike detection.
- Allow export for offline analysis.

### 2.3 Non-goals for MVP

- Full social publishing/engagement suite.
- Replying to Threads users from this product.
- Guaranteed crawling of the complete reply/comment tree of arbitrary third-party Threads posts.
- X, Facebook, Instagram, TikTok, Reddit, YouTube or news monitoring.
- Downloading and storing image/video binaries.
- Full influencer CRM.
- Automated moderation actions on Threads.
- Automated public responses.
- ML model training infrastructure.

---

## 3. Platform and API scope

### 3.1 Supported platform

MVP:

```text
Threads
```

Future:

```text
Threads
X
Reddit
TikTok
Facebook
Instagram
YouTube
News / Web
```

### 3.2 Threads discovery capability

Use Meta's official Threads API keyword search endpoint.

Current API capability checked for this document exposes:

- query text: `q`
- `search_type`: `TOP | RECENT`
- `search_mode`: `KEYWORD | TAG`
- `limit`
- `since`
- `until`
- field selection
- cursor pagination

The product must isolate Threads API details behind a provider/service layer so API changes do not leak into the rest of the domain.

### 3.3 Replies/comments limitation

The MVP contract is:

> Analyze public social mentions returned by the Threads discovery/search flow.

The MVP must **not** promise:

> For every discovered post, recursively crawl and analyze every reply under that third-party post.

A separate POC must validate reply accessibility, permission review and practical API behavior before third-party reply-tree ingestion is added.

---

## 4. Users and roles

MVP is an internal product.

### 4.1 Roles

#### Admin
Can:
- Manage Threads integration.
- Manage monitoring projects.
- Create/edit/disable/delete listening queries.
- Change sync configuration.
- Trigger manual sync/backfill.
- Trigger re-analysis.
- Change classification thresholds and taxonomy configuration when exposed.
- Manage users/roles.
- View all dashboards, mentions, sync jobs and errors.
- Export data.

#### Analyst
Can:
- View dashboards.
- Search/filter mentions.
- View mention detail.
- Add analyst review/override.
- Export data.
- Trigger re-analysis for an individual mention if allowed.
- Cannot change integration secrets.

#### Viewer
Can:
- View dashboards.
- View/search/filter mentions.
- View mention detail.
- Cannot mutate system configuration.
- Cannot manage integration.
- Export can be enabled or disabled by Admin.

### 4.2 Authentication

Recommended MVP:
- Supabase Auth.
- Internal email authentication.
- Optional Google provider if appropriate for the organization.
- NestJS verifies access tokens and enforces RBAC.

---

## 5. Monitoring project concept

Even though MVP uses one internal monitoring space, create a first-class `monitoring_project`.

Seed:

```text
Project: 1Zone / Eventista Social Listening
Timezone: Asia/Ho_Chi_Minh
Platform: Threads
```

Benefits:
- Future artist/event-specific projects.
- Future competitor project.
- Future customer/tenant separation.
- Different query groups and taxonomies per project.

MVP UI may hide the project switcher if there is only one project.

---

## 6. Listening query management

### 6.1 Default seed queries

| Type | Value | Mode | Status |
|---|---|---|---|
| keyword | `1zone` | KEYWORD | active |
| hashtag/topic tag | `1zone` | TAG | active |
| keyword | `eventista` | KEYWORD | active |
| hashtag/topic tag | `eventista` | TAG | active |

Do not persist `#` as part of the API query value if Threads TAG search expects the raw tag value; the UI can render `#` for display.

### 6.2 Query fields

Each query must support:

- id
- project_id
- platform
- name/display_name
- query_value
- query_type: `keyword | topic_tag`
- search_mode: `KEYWORD | TAG`
- default search type: `RECENT`
- enabled
- include_terms (optional)
- exclude_terms (optional)
- language hints (optional; classifier-level filtering if the source API does not support it)
- polling interval
- overlap window
- initial backfill range
- created_by
- created_at
- updated_at

### 6.3 Query actions

Admin must be able to:

- Create query.
- Edit query.
- Enable/disable query.
- Soft delete query.
- Restore query.
- Run query now.
- Run historical/backfill query.
- See last successful sync.
- See last error.
- See number of posts discovered by the query.

### 6.4 Exclude terms

Support optional exclusion rules to reduce irrelevant results.

Example:

```text
Query: 1zone
Exclude:
- "time zone"
- "zone 1"
```

Exclusion can be implemented after ingestion if Threads search syntax cannot express the desired logic.

---

## 7. Collection requirements

### 7.1 Collection mode

MVP uses polling.

Recommended initial configuration:

```text
Default interval: 10 minutes
Overlap: 20 minutes
Search type: RECENT
```

Both values must be configurable.

The overlap intentionally re-fetches recent content. Deduplication prevents duplicate storage and reduces the chance of missing late-indexed content.

### 7.2 Collector behavior

For each active query:

1. Create sync job.
2. Determine `since` and `until`.
3. Call Threads search.
4. Follow pagination.
5. Normalize each item.
6. Validate required fields.
7. Calculate stable source identity.
8. Upsert post.
9. Upsert query match.
10. Update `last_seen_at`.
11. Queue analysis only when:
   - post is new; or
   - text changed; or
   - analysis is missing/outdated.
12. Persist API usage metadata.
13. Mark job success/partial/failed.

### 7.3 Deduplication

Unique identity:

```text
(platform, platform_post_id)
```

One post may match multiple listening queries.

Never duplicate a post solely because it was found from both `1zone` and `eventista`.

### 7.4 Content change detection

Persist:
- `content_hash`
- `first_seen_at`
- `last_seen_at`

If the same post ID is later returned with changed text:
- update normalized content
- increment revision/version
- mark analysis stale
- re-run analysis

### 7.5 API resilience

Must handle:

- 401 / expired token
- 403 / permission issue
- 429 / rate limit
- 5xx
- timeouts
- malformed item
- pagination interruption
- partial success

Use:
- bounded retries
- exponential backoff with jitter
- idempotent writes
- circuit-breaking / temporary pause after repeated provider failures

Do not hard-code an assumed Meta quota. Read applicable rate-limit headers/usage signals when available and expose them operationally.

---

## 8. Stored content

### 8.1 Store

For each mention store, when available:

- Threads post ID
- text
- username
- permalink
- timestamp/published_at
- media type
- media URL / thumbnail URL
- shortcode
- owner/source metadata allowed by API
- is_quote_post
- quoted/reposted relation IDs where available
- has_replies
- alt text where returned
- link attachment URL
- relevant normalized raw fields
- first_seen_at
- last_seen_at
- content_hash
- query matches

### 8.2 Do not store in MVP

- Image binary
- Video binary
- Full copied media assets
- Unnecessary personal profile data
- Data outside the API response simply because it is available on the public website

### 8.3 Raw provider response

Keep a controlled JSONB snapshot of provider fields required for debugging/reprocessing.

Do not use raw JSON as the primary query model. Important fields must be normalized into columns.

---

## 9. Content intelligence taxonomy

A mention may carry multiple independent dimensions.

### 9.1 Relevance

Recommended change from binary to three states:

```text
relevant
uncertain
irrelevant
```

Fields:
- label
- score/confidence
- optional short explanation

Default dashboard behavior:
- include `relevant`
- optionally include `uncertain`
- exclude `irrelevant`

Why:
A query such as `1zone` can match unrelated phrases. Relevance filtering protects all downstream metrics.

### 9.2 Sentiment

MVP:

```text
positive
neutral
negative
```

Fields:
- sentiment_label
- confidence

A future `mixed` class can be introduced only after reviewing real data.

### 9.3 Safety

Business-level safety:

```text
safe
sensitive
severe
```

Provider categories should be stored independently, e.g.:

- harassment
- harassment/threatening
- hate
- hate/threatening
- sexual
- sexual/minors
- violence
- violence/graphic
- self-harm
- self-harm/intent
- self-harm/instructions
- illicit
- illicit/violent

Important:
- `safe/sensitive/severe` is a **product policy mapping**, not an API-native truth.
- Mapping thresholds must be versioned and configurable.
- Do not equate `negative` sentiment with unsafe content.

### 9.4 Intent

Multi-label.

Initial labels:

```text
praise
complaint
question
recommendation
purchase_intent
boycott
spam
information
support_request
comparison
other
```

A post can be both:
- `question`
- `purchase_intent`

### 9.5 Topic

Multi-label.

Initial taxonomy:

```text
artist
ticket
venue
price
performance
membership
payment
queue
customer_service
event
merchandise
other
```

A post can be:
- `artist`
- `ticket`
- `price`

### 9.6 Language

At minimum:

```text
vi
en
ko
ja
th
zh
other
unknown
```

Prefer ISO 639-1 when available.

### 9.7 Summary

Generate a concise one-sentence summary for relevant content only.

Do not generate a summary for:
- empty content
- obvious spam when configured to skip
- irrelevant content when configured to skip

### 9.8 Classification explanation

Optional short, user-facing explanation:

```text
"Complaint about ticket price."
```

Do not store hidden model chain-of-thought.

### 9.9 Confidence

For LLM-generated classifications, call this:

```text
model_confidence
```

It is used for prioritization/review, not treated as a calibrated probability.

Recommended review behavior:
- high confidence → auto accept
- medium confidence → accepted but visually marked
- low confidence → review queue / uncertain

Thresholds are configurable.

---

## 10. Analysis pipeline

### 10.1 Processing order

```text
Normalize
  ↓
Relevance
  ↓
If irrelevant → stop most expensive analysis
  ↓
Safety moderation
  ↓
Structured classifier
  ├ sentiment
  ├ intent[]
  ├ topic[]
  ├ language
  └ summary
  ↓
Persist versioned result
```

Language detection may run before relevance if it helps the classifier.

### 10.2 Provider abstraction

The application must not expose provider-specific model names throughout the domain.

Define interfaces conceptually:

```ts
SafetyProvider
ContentClassifier
```

Each result records:
- provider
- model
- model snapshot/version if available
- prompt_version
- taxonomy_version
- policy_version
- analyzed_at

### 10.3 Re-analysis

Admin can:
- re-analyze one post
- re-analyze filtered posts
- re-analyze posts using outdated analysis versions

Re-analysis must create a new version/run while preserving enough previous metadata for audit/comparison.

### 10.4 Analyst override

Recommended P1/MVP+:

Analyst can override:
- relevance
- sentiment
- safety
- intent
- topic

Store:
- original AI value
- override value
- reviewer
- reason/note
- timestamp

Dashboard should use the effective value:
`manual override > latest accepted AI analysis`.

---

## 11. Dashboard requirements

### 11.1 Dashboard filters

Global filters:

- monitoring project
- date/time range
- keyword/query
- query type
- sentiment
- safety
- intent
- topic
- language
- relevance
- analysis status

Time presets:

```text
Last 1 hour
Last 24 hours
Last 7 days
Last 30 days
Custom
```

Default timezone:
`Asia/Ho_Chi_Minh`

Store UTC internally.

### 11.2 KPI cards

P0:

- Total Relevant Mentions
- Mention Growth vs previous period
- Positive Rate
- Negative Rate
- Sensitive+Severe Rate
- Complaint Rate

Optional:
- Uncertain Relevance Count
- Severe Count
- Analysis Coverage

### 11.3 Charts

P0:

1. Mentions over time
2. Sentiment distribution
3. Sentiment over time
4. Safety distribution
5. Top topics
6. Intent distribution

P1:
7. Language distribution
8. Topic × sentiment
9. Keyword share of mentions
10. Negative-topic contributors

### 11.4 Comparison

Support:
- current range
- previous equal-length period

Example:
- current 24h vs previous 24h
- current 7d vs previous 7d

### 11.5 Chart drill-down

Clicking a chart segment should open Mentions Explorer with equivalent filters when practical.

Example:
- click `Negative / Ticket`
- open mentions filtered by `sentiment=negative&topic=ticket`

---

## 12. Mentions Explorer

### 12.1 List view

Each row/card should show:

- platform icon
- author/username
- publish time
- text preview
- matched queries
- sentiment badge
- safety badge
- top intent(s)
- top topic(s)
- language
- analysis confidence indicator
- original Threads link

### 12.2 Filters

- date
- keyword
- text search
- sentiment
- safety
- intent
- topic
- language
- relevance
- reviewed/unreviewed
- analysis status

### 12.3 Sorting

- newest
- oldest
- highest safety severity
- lowest confidence
- optionally highest relevance score

### 12.4 Detail view

Show:

#### Original
- full stored text
- username
- timestamp
- permalink
- media metadata/preview URL if allowed
- matched query list
- first seen / last seen

#### Analysis
- relevance
- sentiment
- safety
- safety categories/scores
- intent(s)
- topic(s)
- language
- summary
- model confidence
- model/prompt/taxonomy version
- analyzed_at

#### Operations
- re-analyze
- manual override
- copy post ID
- open on Threads

---

## 13. Keyword/Listening Query screen

Table columns:

- Query
- Type
- Project
- Enabled
- Poll interval
- Last sync
- Last result count
- Last status
- Created by
- Actions

Actions:
- edit
- disable/enable
- run now
- backfill
- view mentions
- soft delete

Create/edit form:
- query value
- type
- exclude terms
- interval
- backfill period
- enabled

---

## 14. Integration & system status screen

Show:

### Threads connection
- connected/disconnected
- token status
- permission status where detectable
- last successful provider request
- last provider error

Do not reveal tokens.

### Collector
- active queries
- last global sync
- jobs in progress
- failed jobs
- collection lag

### Analyzer
- pending count
- failed count
- analysis lag
- current model/prompt/taxonomy version

### Database
- optional approximate stored mention count
- optional DB usage/admin link

---

## 15. Export

P1 recommended.

Allow CSV export of currently filtered mentions.

Columns should include:
- post ID
- permalink
- username
- text
- published_at
- matched queries
- relevance
- sentiment
- safety
- intent
- topics
- language
- summary
- analyzed_at

For large exports:
- create asynchronous export job only if the product infrastructure supports background jobs
- MVP can cap synchronous export volume and clearly show the cap

---

## 16. Analytics definitions

Definitions must be stable and documented.

### 16.1 Relevant mention count

```text
count(distinct social_post_id)
where effective_relevance = relevant
```

A post matching multiple queries counts once in “All Queries” view.

When grouped by query, the same post can appear in multiple query groups.

### 16.2 Positive rate

```text
positive relevant analyzed mentions
/
relevant mentions with a completed sentiment label
```

### 16.3 Negative rate

```text
negative relevant analyzed mentions
/
relevant mentions with a completed sentiment label
```

### 16.4 Safety rate

Recommended KPI:

```text
(sensitive + severe) relevant analyzed mentions
/
relevant mentions with completed safety analysis
```

Show Severe separately when material.

### 16.5 Complaint rate

```text
relevant mentions containing complaint intent
/
relevant mentions with completed intent analysis
```

Because intent is multi-label, intent percentages do not have to sum to 100%.

### 16.6 Topic percentage

Because topic is multi-label, topic percentages do not have to sum to 100%.

### 16.7 Mention growth

```text
(current_mentions - previous_mentions)
/
previous_mentions
```

If previous_mentions = 0:
- do not display misleading infinite percentage
- show `New` or a defined empty-state behavior

---

## 17. Data quality requirements

Must track:

- discovered count
- inserted count
- duplicate count
- invalid count
- relevant count
- irrelevant count
- analysis success count
- analysis failure count
- analysis skipped count

Dashboard should distinguish:
- “0 mentions”
- “sync failed”
- “analysis pending”

These are not equivalent states.

---

## 18. Priority matrix

### P0 — required for MVP
- Internal authentication
- Admin/Analyst/Viewer RBAC
- Monitoring project
- Threads integration
- Keyword/topic-tag CRUD
- Default 1Zone/Eventista queries
- Scheduled search
- Cursor pagination
- Retry/backoff
- Deduplication
- Supabase storage
- Relevance
- Sentiment
- Safety
- Intent
- Topic
- Language
- Versioned analysis
- Dashboard KPI
- 6 core charts
- Mentions Explorer
- Mention detail
- Filters
- Sync/system status
- Manual run
- Error logging

### P1 — highly recommended after core MVP
- Manual backfill UI
- CSV export
- Analyst override/review
- Re-analysis UI
- low-confidence review queue
- topic × sentiment analysis
- negative-topic contributors
- daily aggregate table/materialized view
- configurable policy thresholds

### P2
- Spike detection
- Alerts: Slack/email/webhook
- Competitor comparison
- Saved filters
- Scheduled reports
- X integration
- Additional platforms
- User-defined custom taxonomy
- advanced multi-project UI
- semantic clustering/embeddings

---

## 19. UX requirements

Use Untitled UI as the primary visual/component system.

UX principles:

- Dashboard-first, not configuration-first.
- Strong empty/error/loading states.
- Filters remain visible and predictable.
- Badges use consistent semantic styling.
- Avoid using color alone to communicate safety/sentiment.
- Tooltip every non-obvious metric.
- Show denominator/definition for percentage KPIs.
- Charts must support responsive layout.
- Table/list needs pagination or virtualized loading as volume grows.
- External link icon for Threads permalink.
- Every aggregate should have a path to underlying mentions.
- “AI result” and “analyst override” must be distinguishable.

Recommended layout:

```text
Sidebar
├ Overview
├ Mentions
├ Listening Queries
├ Reviews          (P1)
├ System Status
└ Settings
```

---

## 20. Accessibility

At minimum:
- Keyboard navigation.
- Visible focus state.
- Proper labels.
- Screen-reader compatible controls.
- WCAG-aware contrast.
- Chart data accessible in table/tooltip form where practical.
- Do not encode sentiment/safety solely by red/green.

Untitled UI React uses React Aria for many interactive components; follow its required client-component/provider setup rather than reimplementing interaction primitives.

---

## 21. Acceptance criteria — product level

MVP is acceptable when all of the following are true:

1. Admin can connect/configure Threads access without exposing secrets to FE.
2. Seed queries exist for 1Zone/Eventista.
3. Admin can add a new keyword without code deployment.
4. Collector can run repeatedly without producing duplicate posts.
5. A failed provider call does not corrupt existing data.
6. Every new relevant post receives the required analysis dimensions.
7. Irrelevant posts are excluded from dashboard metrics by default.
8. Dashboard supports 24h/7d/30d/custom ranges.
9. Dashboard percentages follow documented denominators.
10. User can drill from aggregate analytics to raw stored mention.
11. User can open original content on Threads.
12. Sync/system status explains when ingestion is failing.
13. Analysis results record model/prompt/taxonomy versions.
14. User roles enforce permissions on BE, not only FE.
15. No provider access token/service-role secret is present in browser code.
16. Core dashboard remains useful when some posts are pending/failed analysis.
17. Product supports at least one full backfill/re-analysis test without duplicated records.
