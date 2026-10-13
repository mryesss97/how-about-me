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

Local: Docker Postgres (`pnpm db:up`) + `PROVIDERS_MODE=fake`. CI: Postgres service container. Staging: real Supabase + real providers with small budget; QC runs manual test cases there. Production: smoke only (read-only).

## 8. Definition of "tested" for a story

Unit tests for logic, integration test for persistence/HTTP behaviour, manual QC test cases executed on staging and linked in the issue, analytics reconciliation for any metric change.

## 9. Running the API integration suite

| Where | Command                                                                              | Database                                                                                                      |
| ----- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Local | `pnpm db:up` then `pnpm test:int`                                                    | `how_about_me_test` in Docker Postgres (created by `docker/postgres/init`); override with `TEST_DATABASE_URL` |
| CI    | `ci.yml` job `test`, step `API integration tests` (`pnpm test:int`) after unit tests | Postgres service container                                                                                    |

- `pnpm test:int` runs the Turborepo task `test:int` (`dependsOn: ^build`, never cached), so `packages/contracts` and `packages/taxonomy` are built before Jest resolves them. It is not part of `pnpm verify` or the `pre-push` hook because it needs Postgres.
- `test/global-setup.ts` applies migrations to the test database; `test/setup-after-env.ts` sets `PROVIDERS_MODE=fake` and the test JWT secret. Suites run `--runInBand` and reset tables with `resetDb()`.
- **ESM-only dependencies.** Jest 30 runs tests in a CommonJS module registry. `jose` (Supabase JWT verification) ships ESM only, so `require("jose")` from the compiled `AppModule` fails with `Must use import to load ES Module`. `apps/api/jest.config.ts` lets `ts-jest` compile `jose` to CJS (`transformIgnorePatterns` allow-list plus a `.js` transform, target `es2022`). Production is unaffected: `nest build` emits CJS and Node 24 loads `jose` through native `require(esm)`.
- Decision (2026-10-13, #137). Rejected alternative: run Jest with `--experimental-vm-modules` and raise `engines.node` to `>=24.9`. Jest only takes its `require(esm)` path when both hold (verified: Node 24.4.1 fails even with the flag; 24.21.0 passes). It relies on an experimental Node API, prints an `ExperimentalWarning`, needs `NODE_OPTIONS` plumbing per platform, and forces every developer onto 24.9+. The transform works on any Node 24.x with stock Jest. Cost: tests exercise a CJS-compiled copy of `jose` (module syntax only, no down-levelling). Revisit if `jose` adds top-level `await` (it cannot compile to CJS) or when Jest's ESM support is stable.
- New ESM-only dependency imported by API code: add its name to the `transformIgnorePatterns` allow-list.
