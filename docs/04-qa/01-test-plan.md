# 01 · QA Test Plan (MVP)

| Field   | Value                                                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Approved (baseline v1.0)                                                                                                                                                                                                                  |
| Owner   | QC Engineer                                                                                                                                                                                                                               |
| Related | [../02-architecture/10-testing-strategy.md](../02-architecture/10-testing-strategy.md) · [test-cases/](test-cases/) · [02-analytics-qa-checklist.md](02-analytics-qa-checklist.md) · [03-ai-evaluation-plan.md](03-ai-evaluation-plan.md) |

## 1. Objectives

Verify that the MVP meets the functional requirements (FR), business rules (BR) and product acceptance criteria; that analytics reconcile with underlying data; that RBAC and secret handling are enforced server-side; and that AI classification quality meets the v1 gate.

## 2. Scope

In: all P0 epics E01–E10, E13 gates; P1 epics in M6. Out: load beyond NFR targets, penetration testing (basic checklist only), non-Threads platforms.

## 3. Test levels & ownership

| Level                          | Owner                              | Where                 | When                           |
| ------------------------------ | ---------------------------------- | --------------------- | ------------------------------ |
| Unit / integration (automated) | Engineers                          | CI                    | every PR                       |
| Contract fixtures              | Engineers                          | CI                    | every PR                       |
| Functional manual (test cases) | QC                                 | staging               | per merged epic                |
| E2E smoke (Playwright)         | Engineers + QC                     | staging               | nightly, release               |
| Analytics reconciliation       | QC (+BE)                           | staging seeded + real | M4, release, any metric change |
| AI evaluation                  | QC + BA                            | eval script           | M3 gate, prompt/model change   |
| Performance                    | Tech Lead                          | staging               | M5                             |
| UAT                            | Stakeholders, facilitated by BA/QC | staging               | M5                             |
| Regression                     | QC                                 | release branch        | release                        |

## 4. Environments & data

- **Staging** with real Supabase Auth; three test accounts: `qa.admin@`, `qa.analyst@`, `qa.viewer@` (owner to create) mapped to roles.
- **Fake providers** (`PROVIDERS_MODE=fake`) for deterministic collector/analysis scenarios (fixtures: multi-page, empty, 429, 401, changed-text, multi-query overlap).
- **Real providers** for POC-derived data and AI evaluation, low daily budget.
- **Seeded analytics dataset** (`pnpm --filter api seed:analytics-fixture`) with known expected numbers (documented in `test/fixtures/analytics-expected.json`).

## 5. Entry / exit criteria per epic

Entry: story merged to `develop`, deployed to staging, engineer smoke done, test cases drafted.
Exit: all P0 test cases pass; no open Sev-1/Sev-2 bugs; Sev-3 triaged; results recorded in the QC issue; sign-off comment.

## 6. Defect severity

| Sev | Definition                                                                        | SLA                       |
| --- | --------------------------------------------------------------------------------- | ------------------------- |
| 1   | data corruption/duplication, security (secret leak, RBAC bypass), production down | fix immediately           |
| 2   | P0 feature broken, wrong metric/denominator, sync silently failing                | fix before milestone exit |
| 3   | functional bug with workaround, UX defect                                         | fix before release        |
| 4   | cosmetic / copy                                                                   | backlog                   |

## 7. Test case conventions

File per epic in `test-cases/` named `TC-<EPIC>-<topic>.md`. Columns: ID · Title · Pre-conditions · Steps · Expected · Refs (FR/BR/US) · Pri · Type (M manual / A automated / A+M). IDs are stable; new cases append.

## 8. UAT

Script (60 min): login per role → read Overview for last 7 d → explain KPIs with tooltips → drill into negative/ticket → open a mention on Threads → add a query (admin) → run now → see job → System Status. Feedback captured in `docs/04-qa/uat/<date>.md`; blocking feedback becomes Sev-2.

## 9. Deliverables

Test cases (this folder), execution logs in QC issues, analytics reconciliation report, AI evaluation report, regression report, UAT notes, release sign-off.

## 10. Schedule (aligned to milestones)

M2: TC-AUTH, TC-PROJ, TC-INT, TC-LQ, TC-COL · M3: TC-ANA + eval · M4: TC-DASH, TC-MEN, TC-SYS + reconciliation · M5: regression, perf support, UAT · M6: TC-REV, TC-EXP.
