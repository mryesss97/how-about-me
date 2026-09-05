# How About Me — Threads Social Listening · Documentation Hub

> Internal social-listening & content-intelligence product for **Threads**.
> Default listening terms: `1zone`, `#1zone`, `eventista`, `#eventista`.
> Docs version: **1.0 (MVP)** · Baseline date: **2026-09-05** · Owner: Product/BA

This folder is the single source of truth for **what** we build (product), **how** we build it (architecture & engineering), **when** we deliver it (delivery), **how we verify it** (QA) and **how we run it** (operations).

Every GitHub issue links back to the relevant section here. When a decision changes, update the doc **first**, then the code.

---

## Reading order

| #   | Audience     | Start here                                                                                                                                            |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Everyone     | [01-product/01-vision-scope.md](01-product/01-vision-scope.md)                                                                                        |
| 2   | Product / QC | [01-product/03-user-stories.md](01-product/03-user-stories.md) → [01-product/04-functional-requirements.md](01-product/04-functional-requirements.md) |
| 3   | Engineers    | [02-architecture/01-system-overview.md](02-architecture/01-system-overview.md) → [06-engineering/01-local-setup.md](06-engineering/01-local-setup.md) |
| 4   | PM / Lead    | [03-delivery/01-milestones-timeline.md](03-delivery/01-milestones-timeline.md) → [03-delivery/02-work-breakdown.md](03-delivery/02-work-breakdown.md) |
| 5   | QC           | [04-qa/01-test-plan.md](04-qa/01-test-plan.md) → [04-qa/test-cases/](04-qa/test-cases/)                                                               |

---

## Folder map

```text
docs/
├─ 00-source/          Original requirements pack v1.0 (verbatim, read-only, traceability anchor)
├─ 01-product/         Vision, personas & RBAC, user stories, FR/NFR, business rules, metrics, taxonomy, UX spec
├─ 02-architecture/    System/BE/FE design, data model, API contract, pipelines, security, observability, testing, deployment, ADRs
├─ 03-delivery/        Milestones & timeline, WBS, backlog (source of GitHub issues), team/RACI, risks, DoR/DoD, release plan
├─ 04-qa/              Test plan, test cases per epic, analytics QA checklist, AI evaluation plan, bug guideline
├─ 05-operations/      Threads API POC plan, runbook, cost model, retention & purge
└─ 06-engineering/     Local setup, monorepo structure, coding conventions, git workflow, code review, env vars, CI/CD
```

## Document index

### 01 — Product

- [01-vision-scope.md](01-product/01-vision-scope.md) — problem, objectives, scope, non-goals, success metrics, assumptions & constraints
- [02-personas-rbac.md](01-product/02-personas-rbac.md) — personas, roles, permission matrix (server-enforced)
- [03-user-stories.md](01-product/03-user-stories.md) — epics E01–E13, user stories `US-xxx` with acceptance criteria
- [04-functional-requirements.md](01-product/04-functional-requirements.md) — `FR-xxx` catalogue + traceability matrix
- [05-non-functional-requirements.md](01-product/05-non-functional-requirements.md) — `NFR-xxx` catalogue
- [06-business-rules-glossary.md](01-product/06-business-rules-glossary.md) — `BR-xxx` rules + glossary
- [07-metric-definitions.md](01-product/07-metric-definitions.md) — KPI formulas, denominators, edge cases
- [08-taxonomy-classification.md](01-product/08-taxonomy-classification.md) — taxonomy v1, confidence policy, safety policy v1
- [09-ux-specification.md](01-product/09-ux-specification.md) — information architecture, routes, per-screen spec, states, a11y

### 02 — Architecture

- [01-system-overview.md](02-architecture/01-system-overview.md)
- [02-backend-design.md](02-architecture/02-backend-design.md)
- [03-frontend-design.md](02-architecture/03-frontend-design.md)
- [04-data-model.md](02-architecture/04-data-model.md)
- [05-api-contract.md](02-architecture/05-api-contract.md)
- [06-ingestion-pipeline.md](02-architecture/06-ingestion-pipeline.md)
- [07-analysis-pipeline.md](02-architecture/07-analysis-pipeline.md)
- [08-security-secrets.md](02-architecture/08-security-secrets.md)
- [09-observability.md](02-architecture/09-observability.md)
- [10-testing-strategy.md](02-architecture/10-testing-strategy.md)
- [11-environments-deployment.md](02-architecture/11-environments-deployment.md)
- [adr/](02-architecture/adr/README.md) — Architecture Decision Records

### 03 — Delivery

- [01-milestones-timeline.md](03-delivery/01-milestones-timeline.md)
- [02-work-breakdown.md](03-delivery/02-work-breakdown.md)
- [backlog.json](03-delivery/backlog.json) — machine-readable backlog → GitHub issues (`pnpm issues:sync`)
- [03-team-raci.md](03-delivery/03-team-raci.md)
- [04-risk-register.md](03-delivery/04-risk-register.md)
- [05-definition-of-ready-done.md](03-delivery/05-definition-of-ready-done.md)
- [06-release-plan-checklist.md](03-delivery/06-release-plan-checklist.md)

### 04 — QA

- [01-test-plan.md](04-qa/01-test-plan.md)
- [test-cases/](04-qa/test-cases/) — one file per epic
- [02-analytics-qa-checklist.md](04-qa/02-analytics-qa-checklist.md)
- [03-ai-evaluation-plan.md](04-qa/03-ai-evaluation-plan.md)
- [04-bug-report-guideline.md](04-qa/04-bug-report-guideline.md)

### 05 — Operations

- [01-poc-threads-api.md](05-operations/01-poc-threads-api.md)
- [02-runbook.md](05-operations/02-runbook.md)
- [03-cost-model.md](05-operations/03-cost-model.md)
- [04-data-retention-purge.md](05-operations/04-data-retention-purge.md)

### 06 — Engineering handbook

- [01-local-setup.md](06-engineering/01-local-setup.md)
- [02-monorepo-structure.md](06-engineering/02-monorepo-structure.md)
- [03-coding-conventions.md](06-engineering/03-coding-conventions.md)
- [04-git-workflow.md](06-engineering/04-git-workflow.md)
- [05-code-review-guideline.md](06-engineering/05-code-review-guideline.md)
- [06-environment-variables.md](06-engineering/06-environment-variables.md)
- [07-ci-cd.md](06-engineering/07-ci-cd.md)

---

## Conventions used in these docs

| Prefix          | Meaning                       | Example                   |
| --------------- | ----------------------------- | ------------------------- |
| `E##`           | Epic                          | `E04 Collector & Sync`    |
| `US-###`        | User story                    | `US-042`                  |
| `FR-###`        | Functional requirement        | `FR-110`                  |
| `NFR-###`       | Non-functional requirement    | `NFR-020`                 |
| `BR-###`        | Business rule                 | `BR-007`                  |
| `TC-<epic>-###` | Test case                     | `TC-COL-012`              |
| `ADR-####`      | Architecture decision         | `ADR-0003`                |
| `T-###`         | Backlog task (→ GitHub issue) | `T-071`                   |
| `M#`            | Milestone                     | `M3 Content Intelligence` |

Priority: **P0** = required for MVP · **P1** = right after MVP · **P2** = later.

Status of a document is shown in its header: `Draft` → `Review` → `Approved` → `Superseded`.

## Open decisions requiring owner input

Tracked in [03-delivery/02-work-breakdown.md#open-inputs](03-delivery/02-work-breakdown.md#open-inputs). Short list:

1. Meta app / Threads credentials & App Review path (blocks M1).
2. Supabase projects for `staging` and `production` (blocks M2 deployment).
3. LLM classifier provider + model for v1 (default assumption: OpenAI structured outputs, small model) and OpenAI API key.
4. Hosting target for Next.js and NestJS worker (assumption: Vercel + a persistent Node host such as Railway/Fly/Render).
5. Team roster & capacity (assumption in [03-team-raci.md](03-delivery/03-team-raci.md)).
6. Untitled UI PRO license (only if PRO components are needed; free tier assumed).
