# 06 · Release Plan & MVP Launch Checklist (`v0.1.0`)

Target: **2026-11-14** (M5). Release manager: Tech Lead. Approver: Product Owner.

## 1. Release steps

1. Freeze `develop` (Mon of release week); create `release/v0.1.0`.
2. Deploy release branch to staging; run full regression (QC) + Playwright + perf smoke.
3. Fix only blockers on the release branch (`fix/*` → release).
4. UAT with stakeholders (2 sessions) using the UAT script in [../04-qa/01-test-plan.md](../04-qa/01-test-plan.md#8-uat).
5. Owner go/no-go.
6. Merge `release/v0.1.0` → `main`, tag `v0.1.0`, generate changelog; merge back to `develop`.
7. Production deploy: migrations → API/worker → web; verify `/health/ready`, first scheduled sync, System Status.
8. Post-release monitoring 48 h; retrospective.

## 2. Product acceptance (source §21, all must be true)

- [ ] 1. Admin can configure Threads access without exposing secrets to FE
- [ ] 2. Seed queries exist for 1Zone/Eventista
- [ ] 3. Admin can add a keyword without deployment
- [ ] 4. Collector runs repeatedly without duplicate posts
- [ ] 5. Failed provider call does not corrupt existing data
- [ ] 6. Every new relevant post receives all analysis dimensions
- [ ] 7. Irrelevant posts excluded from dashboard by default
- [ ] 8. Dashboard supports 24h/7d/30d/custom
- [ ] 9. Percentages follow documented denominators
- [ ] 10. Drill from aggregate to raw mention
- [ ] 11. Open original content on Threads
- [ ] 12. System status explains failing ingestion
- [ ] 13. Analysis results record model/prompt/taxonomy versions
- [ ] 14. Roles enforced on BE
- [ ] 15. No provider token / service-role secret in browser code
- [ ] 16. Dashboard useful with pending/failed analysis present
- [ ] 17. One full backfill/re-analysis test without duplicates

## 3. Security checklist

Source: [../02-architecture/08-security-secrets.md §10](../02-architecture/08-security-secrets.md#10-security-checklist-release-gate-mirrors-source-8). Executed in T-121 (#101) on 2026-10-18.

| #   | Item                                       | Status | Evidence                                                                                                                                                                                                    |
| --- | ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Service-role key absent from web           | [x]    | `scripts/check-fe-secrets.mjs` + `scripts/fe-secrets.test.mjs`; CI `pnpm check:fe-secrets --build-env`; gitleaks job (`.github/workflows/ci.yml`)                                                           |
| 2   | Threads token & OpenAI key absent from web | [x]    | Same scanner and CI jobs as #1                                                                                                                                                                              |
| 3   | Log redaction                              | [x]    | `apps/api/src/common/logging/logger.config.spec.ts` (TC-SYS-009, NFR-014) — real pino stream, fake secrets asserted absent                                                                                  |
| 4   | RBAC matrix green                          | [x]    | `apps/api/test/integration/rbac.int-spec.ts`; `apps/api/src/common/auth/roles-coverage.spec.ts` (every POST/PUT/PATCH/DELETE has `@Roles`, FR-015)                                                          |
| 5   | Admin mutations audited                    | [x]    | `apps/api/test/integration/audit.int-spec.ts`                                                                                                                                                               |
| 6   | Input validation                           | [x]    | Zod pipe `apps/api/src/common/pipes/zod-validation.pipe.ts` with `@how-about-me/contracts` schemas                                                                                                          |
| 7   | Throttling run/bulk/export/verify          | [x]    | `sync-jobs/run-now-throttle.ts`, `analysis/bulk-reanalyze-throttle.ts`, `export/export-throttle.ts`, verify `@Throttle` in `integrations.controller.ts`; test `integrations.int-spec.ts` (6th verify → 429) |
| 8   | Text rendering, safe links                 | [x]    | `highlight-text.tsx` (no `dangerouslySetInnerHTML`); `safePermalink()` https-only in `mention-row.tsx` (+ `original-panel.test.tsx`, `mention-row.test.tsx`)                                                |
| 9   | Production CORS restricted                 | [x]    | `config/env.schema.spec.ts` (wildcard rejected in production); `test/integration/security-headers.int-spec.ts` (allow-list + helmet headers)                                                                |
| 10  | Separate staging/prod secrets              | [ ]    | GitHub Environments in `deploy-*.yml`; pending owner confirmation                                                                                                                                           |
| 11  | Backups verified (restore drill)           | [ ]    | Pending staging restore drill                                                                                                                                                                               |
| 12  | Purge tested on staging                    | [ ]    | `apps/api/src/cli/purge.ts` + `purge.int-spec.ts`; staging run pending                                                                                                                                      |

## 4. Observability checklist → [../02-architecture/09-observability.md §7](../02-architecture/09-observability.md#7-launch-checklist-mirrors-source-9)

## 5. Analytics QA checklist → [../04-qa/02-analytics-qa-checklist.md](../04-qa/02-analytics-qa-checklist.md)

## 6. Operational readiness

- [ ] Staging soak ≥ 5 days · [ ] alerts wired & tested · [ ] runbook reviewed · [ ] backups verified · [ ] purge tested on staging · [ ] Meta terms/retention reviewed · [ ] on-call rota for launch week · [ ] rollback rehearsed (redeploy previous tag on staging)

## 7. Communication

- Release notes (features, known limitations: reply trees not crawled; `uncertain` handling; P1 items upcoming).
- Stakeholder onboarding session (30 min) + glossary link.
