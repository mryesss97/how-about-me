# 10 · Testing Strategy

| Field   | Value                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------- |
| Status  | Approved (baseline v1.0)                                                                            |
| Source  | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §24             |
| QA docs | [../04-qa/01-test-plan.md](../04-qa/01-test-plan.md) · [../04-qa/test-cases/](../04-qa/test-cases/) |

## 1. Pyramid & tools

| Level             | Scope                                                                                                                                                               | Tool                                              | Where                                                       | Gate              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ----------------- |
| Unit              | pure logic: window calc, hash, term matching, policy mapping, metric math, pagination cursors, badge mapping, filter ↔ URL                                          | Jest (api), Vitest (web, packages)                | co-located `*.spec.ts` / `*.test.ts`                        | PR                |
| Integration (API) | NestJS modules with real Postgres (Docker), fake providers: upsert/dedupe, pagination, retry, claiming, analysis versioning, RBAC matrix, analytics SQL vs fixtures | Jest + Supertest + Testcontainers/Docker Postgres | `apps/api/test/integration/**`                              | PR                |
| Contract          | Threads fixtures → normaliser; classifier schema; API response Zod snapshots                                                                                        | Jest/Vitest                                       | `__fixtures__`, `packages/contracts`                        | PR                |
| E2E               | login → overview → filter → open mention → role restriction → add query → run (fake provider) → mention appears                                                     | Playwright                                        | `apps/web/e2e/**` against local stack `PROVIDERS_MODE=fake` | nightly + release |
| Performance       | NFR-001…007 with seeded 100 k posts                                                                                                                                 | k6 scripts `tools/perf/`                          | staging                                                     | M5                |
| AI evaluation     | prompt/taxonomy accuracy on labelled set                                                                                                                            | `eval:classifier` script                          | M3 gate, on prompt change                                   | manual gate       |
| Security          | FE secret scan, audit, gitleaks, RBAC tests                                                                                                                         | CI scripts                                        | PR                                                          | PR                |

## 2. Unit-test targets (must exist)

- `WindowCalculator`: first run, overlap > interval, clamp, skew.
- `contentHash`: NFC normalisation, media/link inclusion, stability.
- `TermMatcher`: case/diacritics/NFC, include/exclude precedence, empty lists.
- `mapSafetyLevel`: each threshold boundary, `flagged` fallback, severe precedence.
- `ClassifierOutputSchema`: unknown label rejection, `other` exclusivity, clamp, maxLength.
- `MetricMath`: rates with 0 denominators, growth `new`, distinct counting helper, previous-period boundaries across tz.
- `Cursor` encode/decode round-trip & tamper rejection.
- `ProjectRoleGuard`: table-driven role × endpoint.
- Web: `toMentionsHref`, `formatKpi` (`New`, `—`), badge mapping, filters URL parsers.

## 3. Integration-test scenarios (API)

1. Ingest same fixture twice → 1 post, 1 match, counters `inserted=1, duplicated=1`.
2. Same post from two queries → 1 post, 2 matches; analytics distinct count = 1; per-query = 1 each.
3. Changed text → revision 2, old run `stale`, new run pending.
4. Pagination with 3 pages + failure on page 3 → `partial`, `last_cursor`, data of pages 1–2 present.
5. 429 then success → job success, `rate_limit_events=1`.
6. 401 → job failed, integration `expired`, scheduler skips project.
7. Two workers claiming concurrently → no double run (parallel test).
8. Analysis: irrelevant → gate; relevant → full result; schema invalid → retry once → failed.
9. Re-analyze forces new run; dedupe prevents identical version re-run.
10. RBAC matrix: each mutating endpoint × 3 roles + non-member.
11. Analytics: fixture dataset with known counts → overview/timeseries/distributions match expected; compare window correct in `Asia/Ho_Chi_Minh`; drill-down filters return identical ids.
12. Exclude terms: post stored, match excluded, not analysed when all matches excluded.
13. Audit rows written for each admin mutation.

## 4. E2E smoke (Playwright)

`login → overview renders KPIs → change preset 24h → click negative segment → mentions filtered → open detail → viewer cannot see Settings/Integrations → admin adds query → run now → job success → mention appears`. Runs on nightly schedule and before release; uses seeded fake provider fixtures.

## 5. Fixtures

- `apps/api/src/modules/integrations/threads/__fixtures__/*.json`: recorded POC responses (sanitised, no tokens, usernames pseudonymised).
- `apps/api/test/fixtures/posts.seed.ts`: deterministic generator for 100 k posts with analyses (perf & analytics tests).
- `docs/04-qa/datasets/eval-v1.jsonl`: labelled evaluation set (QC-owned).

## 6. Coverage & quality gates

- Coverage ≥ 80 % lines for `apps/api/src/modules/**/*.service.ts` and `packages/**`; reported in CI (no hard fail below on FE until M5).
- Lint & typecheck clean; no `any` without justification comment.
- Flaky test policy: quarantine with issue link within 24 h; fix within sprint.

## 7. Test data & environments

Local: Docker Postgres (`docker compose up db`) + `PROVIDERS_MODE=fake`. CI: Postgres service container. Staging: real Supabase + real providers with small budget; QC runs manual test cases there. Production: smoke only (read-only).

## 8. Definition of "tested" for a story

Unit tests for logic, integration test for persistence/HTTP behaviour, manual QC test cases executed on staging and linked in the issue, analytics reconciliation for any metric change.
