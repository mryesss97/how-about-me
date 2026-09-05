# 01 · Product Vision & Scope

| Field        | Value                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | Approved (baseline v1.0)                                                                                                                                                                |
| Source       | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §1–3, §18 · [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §11 |
| Owner        | Product Owner / BA                                                                                                                                                                      |
| Last updated | 2026-09-05                                                                                                                                                                              |

## 1. Problem statement

1Zone / Eventista are discussed publicly on Threads (tickets, artists, prices, venues, payments, queues, customer service…). Today nobody on the team can answer, with evidence, questions such as _"did negative sentiment about ticket prices rise this week?"_ or _"is this spike real or did the sync fail?"_. Manual searching is slow, non-repeatable, and produces no history.

## 2. Product vision

> **An internal listening desk for Threads**: continuously discover public posts matching configured keywords/topic tags, keep them, classify them along stable dimensions (relevance, sentiment, safety, intent, topic, language), and let analysts move from any aggregate number to the exact original post in one click.

Codename / repository: **how-about-me** (`mryesss97/how-about-me`).

## 3. Objectives & success metrics

### 3.1 Primary objectives (MVP)

| #   | Objective                                                    | Success metric (MVP exit)                                                                                           |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| O1  | Collect relevant public Threads content via the official API | Scheduled sync runs ≥ 5 consecutive days with 0 duplicate `social_posts` and every failure visible in System Status |
| O2  | Persist historical data in Supabase Postgres                 | 30-day range queries answer from first-party storage; no dependency on live Threads calls for dashboards            |
| O3  | Classify content into stable, queryable dimensions           | 100 % of `relevant` posts carry relevance, sentiment, safety, intent[], topic[], language, summary, versioned       |
| O4  | Make trends understandable                                   | Overview shows 6 P0 charts + 6 KPI cards with previous-period comparison for 24h/7d/30d/custom                      |
| O5  | Every aggregate is traceable to mentions                     | Every KPI/chart segment drills into Mentions Explorer with equivalent filters and reconciles to the count           |
| O6  | Admins manage listening queries without code                 | Add/edit/disable/soft-delete/run-now via UI, RBAC enforced server-side                                              |
| O7  | Reliable re-analysis when prompt/model/taxonomy changes      | Re-analysis creates a new versioned run; old runs kept; no duplicate posts                                          |
| O8  | Operational visibility                                       | "0 mentions", "sync failed", "analysis pending" are distinguishable states in UI                                    |

### 3.2 Secondary objectives (design for, not necessarily ship in MVP)

- Data model ready for more brands/artists/events (`project_id` everywhere).
- Architecture ready for X and other platforms (provider adapter).
- Architecture ready for alerts / spike detection (aggregates + job infra).
- Export for offline analysis (P1 CSV).

### 3.3 Business KPIs after launch (to measure product value, not MVP gates)

- Time-to-insight for a weekly brand-health question: < 5 minutes (from > 1 hour manual).
- ≥ 80 % agreement between analyst review and AI relevance on the evaluation set.
- Weekly active internal users ≥ team size of marketing/CS stakeholders.

## 4. Scope

### 4.1 In scope (MVP, P0)

| Area                     | Included                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform                 | Threads only, official Meta Threads API keyword/topic-tag search                                                                                    |
| Auth & RBAC              | Supabase Auth (email; optional Google), roles admin/analyst/viewer enforced by NestJS                                                               |
| Monitoring project       | One seeded project `1Zone / Eventista Social Listening`, timezone `Asia/Ho_Chi_Minh`                                                                |
| Listening queries        | CRUD, enable/disable, soft delete/restore, run now, exclude terms, polling/overlap config, 4 seed queries                                           |
| Collection               | Polling scheduler (default 10 min, overlap 20 min, `RECENT`), cursor pagination, retry/backoff, dedupe, change detection, sync jobs & metrics       |
| Storage                  | Normalized `social_posts` + JSONB raw snapshot; no media binaries                                                                                   |
| Content intelligence     | Relevance (3-state), sentiment, safety (provider categories + policy level), intent[], topic[], language, summary, model_confidence, versioned runs |
| Dashboard                | Global filters, 6 KPI cards, 6 P0 charts, previous-period comparison, drill-down                                                                    |
| Mentions Explorer        | List, filters, sort, detail view, open on Threads, re-analyze (admin)                                                                               |
| Listening Queries screen | Table + create/edit form + actions                                                                                                                  |
| System Status            | Threads connection, collector, analyzer, DB stats                                                                                                   |
| Settings / Integration   | Threads connection status & configuration without exposing secrets                                                                                  |
| Ops                      | Structured logs, health endpoints, audit log for admin mutations                                                                                    |

### 4.2 P1 (immediately after MVP — see M6)

Backfill UI, CSV export, analyst override & review queue, bulk re-analysis, topic × sentiment, negative-topic contributors, language distribution, daily aggregates, configurable policy thresholds.

### 4.3 P2 (later)

Spike detection, alerts (Slack/email/webhook), competitor comparison, saved filters, scheduled reports, X integration, additional platforms, custom taxonomy, multi-project UI, semantic clustering.

### 4.4 Explicit non-goals for MVP

- Publishing/engagement suite, replying to Threads users, automated moderation or public responses.
- Guaranteed crawling of the full reply tree of arbitrary third-party posts (validated separately in the POC — see [05-operations/01-poc-threads-api.md](../05-operations/01-poc-threads-api.md)).
- X, Facebook, Instagram, TikTok, Reddit, YouTube, news monitoring.
- Storing image/video binaries. Influencer CRM. ML training infrastructure.

## 5. Key product decisions (frozen for MVP)

| Decision                | Value                                                                     | ADR                                                                           |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Platform                | Threads only                                                              | —                                                                             |
| Discovery               | Official keyword/topic-tag search; no scraping                            | [ADR-0006](../02-architecture/adr/0006-official-api-only-provider-adapter.md) |
| Persistence             | Supabase Postgres, first-party storage, UTC timestamps                    | [ADR-0004](../02-architecture/adr/0004-supabase-postgres-prisma.md)           |
| Display timezone        | `Asia/Ho_Chi_Minh` default, user selectable                               | —                                                                             |
| Multi-project readiness | `project_id` on all business tables; UI hides switcher with one project   | —                                                                             |
| Seed terms              | `1zone`, `#1zone`, `eventista`, `#eventista` — seeded data, not constants | —                                                                             |
| AI versioning           | Every result stamped with provider/model/prompt/taxonomy/policy versions  | [ADR-0008](../02-architecture/adr/0008-versioned-analysis-runs.md)            |
| Confidence              | `model_confidence` is a prioritisation signal, not calibrated probability | —                                                                             |
| Analytics default       | Exclude `irrelevant`; include `relevant`; `uncertain` optional            | [ADR-0009](../02-architecture/adr/0009-three-state-relevance.md)              |
| Infra                   | Postgres-first: no Redis/Kafka/OpenSearch in MVP                          | [ADR-0005](../02-architecture/adr/0005-postgres-first-no-queue-infra.md)      |

## 6. Assumptions

| ID  | Assumption                                                        | Impact if false                                                                                                    |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A1  | Meta grants keyword search permission to our app within M1        | Whole ingestion blocked → escalate; fall back to owned-account content only                                        |
| A2  | Threads API has no per-request fee at launch                      | Cost model changes; add budget line                                                                                |
| A3  | Volume for seed terms is low (hundreds–low thousands posts/month) | If much higher, pull aggregate tables (P1.5) into MVP                                                              |
| A4  | Team: 1 tech lead (fullstack), 1 BE, 1 FE, 1 QC, PM/BA part-time  | Timeline in [03-delivery/01-milestones-timeline.md](../03-delivery/01-milestones-timeline.md) must be re-baselined |
| A5  | Vietnamese + English are the dominant languages                   | Classifier prompt/eval set must cover additional languages                                                         |
| A6  | Supabase Free for local/POC, Pro for staging/prod                 | Budget approval needed before M2 deploy                                                                            |
| A7  | Untitled UI free tier is sufficient for MVP screens               | Buy PRO or hand-build missing components                                                                           |

## 7. Constraints

- Official API only; comply with Meta Platform Terms; retention verified before production.
- No secrets (Threads token, OpenAI key, Supabase service-role) in the browser.
- RBAC enforced by backend; FE hiding is not authorization.
- Data minimisation: store only fields required for the product purpose.
- Budget guardrail: classifier cost measured in POC before scaling analysis.

## 8. Stakeholders

| Role                     | Interest                                                 |
| ------------------------ | -------------------------------------------------------- |
| Product Owner (anh Đước) | Scope, priorities, budget, Meta/Supabase/OpenAI accounts |
| Marketing / Brand team   | Dashboard consumers (Viewer/Analyst)                     |
| Customer Service         | Complaint/support-request signals                        |
| Engineering              | Delivery, operations                                     |
| QC                       | Verification, analytics reconciliation, AI evaluation    |

## 9. Out-of-scope clarifications (FAQ)

- **"Can we see replies to a viral post?"** — Only what the search endpoint returns. Reply-tree crawling is a POC question, not an MVP promise.
- **"Why is a post counted once when it matched both `1zone` and `eventista`?"** — Identity is `(platform, platform_post_id)`; project-wide totals are distinct; per-query breakdown may show it under each query. See [07-metric-definitions.md](07-metric-definitions.md).
- **"Why is a negative post shown as `safe`?"** — Sentiment and safety are independent dimensions. See [08-taxonomy-classification.md](08-taxonomy-classification.md).
