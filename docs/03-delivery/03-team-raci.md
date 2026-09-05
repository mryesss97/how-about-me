# 03 · Team, Roles & RACI

| Field  | Value                                      |
| ------ | ------------------------------------------ |
| Status | Proposed (roster to be confirmed by owner) |

## 1. Roster (assumption)

| Role                  | Person                             | Capacity  | Focus                                                              |
| --------------------- | ---------------------------------- | --------- | ------------------------------------------------------------------ |
| Product Owner         | anh Đước (@mryesss97)              | part-time | scope, priorities, accounts (Meta/Supabase/OpenAI), acceptance     |
| BA / PM               | TBD (this docs set authored by BA) | 40 %      | backlog, docs, milestone tracking, UAT coordination                |
| Tech Lead (fullstack) | TBD                                | 100 %     | architecture, POC, pipeline, reviews, releases                     |
| Backend Engineer      | TBD                                | 100 %     | collector, analysis, analytics API                                 |
| Frontend Engineer     | TBD                                | 100 %     | Next.js screens, Untitled UI, charts                               |
| QC Engineer           | TBD                                | 100 %     | test cases, execution, analytics reconciliation, AI eval labelling |
| Stakeholders          | Marketing / CS leads               | ad hoc    | UAT, feedback                                                      |

GitHub handles are added to `CODEOWNERS` and issue assignments once confirmed.

## 2. RACI

| Activity                                             | Owner   | BA/PM | Tech Lead | BE    | FE    | QC      |
| ---------------------------------------------------- | ------- | ----- | --------- | ----- | ----- | ------- |
| Scope & priorities                                   | **A/R** | C     | C         | I     | I     | I       |
| Requirements & docs                                  | A       | **R** | C         | C     | C     | C       |
| Architecture & ADRs                                  | I       | C     | **A/R**   | C     | C     | I       |
| Threads POC                                          | A       | I     | **R**     | C     | I     | I       |
| Backend implementation                               | I       | I     | A         | **R** | I     | C       |
| Frontend implementation                              | I       | C     | A         | I     | **R** | C       |
| Test cases & execution                               | I       | C     | C         | C     | C     | **A/R** |
| AI evaluation dataset                                | A       | R     | C         | C     | I     | **R**   |
| Analytics reconciliation                             | I       | C     | C         | R     | I     | **A/R** |
| Release go/no-go                                     | **A**   | R     | R         | C     | C     | R       |
| Operations / on-call                                 | I       | I     | **A/R**   | R     | I     | I       |
| Accounts & secrets (Meta, Supabase, OpenAI, hosting) | **A/R** | I     | C         | I     | I     | I       |

R = Responsible, A = Accountable, C = Consulted, I = Informed.

## 3. Working agreements

- Issues are the unit of work; every PR references an issue (`Closes #123`).
- Docs updated in the same PR when behaviour changes (DoD).
- Code review within 1 business day; blockers raised in standup.
- QC gets a staging build for every merged epic; bugs filed with template ([../04-qa/04-bug-report-guideline.md](../04-qa/04-bug-report-guideline.md)).
- Definitions: [05-definition-of-ready-done.md](05-definition-of-ready-done.md).

## 4. Communication

- Channel: team chat (Slack/Discord — owner to confirm) with `#ham-dev`, `#ham-qa`, `#ham-alerts`.
- Weekly status note by BA/PM: milestone burn-down, risks, decisions needed.
