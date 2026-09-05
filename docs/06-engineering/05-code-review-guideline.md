# 05 · Code Review Guideline

## Goals

Correctness against docs (FR/BR/API), safety (secrets, RBAC, validation), maintainability, tests, observability.

## Reviewer checklist

- [ ] PR links an issue; scope matches; docs updated where behaviour changed.
- [ ] Contract changes are additive or versioned; `packages/contracts` + OpenAPI updated; FE client compiles.
- [ ] Business rules honoured (check `BR-` references); metric math matches doc 07.
- [ ] RBAC decorators on every mutation; validation via Zod; no raw `process.env`.
- [ ] No secrets/tokens in code, logs, fixtures, screenshots.
- [ ] DB: migration present, indexes for new filters, transactions where multi-write, no N+1 in list endpoints.
- [ ] Idempotency for jobs/ingestion; error mapping to stable codes.
- [ ] Tests: unit for logic, integration for persistence/HTTP; fixtures sanitised.
- [ ] Logging with ids; audit for admin mutations; metrics where doc 09 requires.
- [ ] FE: states (loading/empty/error/forbidden), a11y (labels, keyboard), URL filters, no colour-only encoding.
- [ ] Performance: pagination, bounded queries, lazy charts.
- [ ] Naming/style per conventions; no dead code; TODOs have issues.

## Author checklist (before requesting review)

Self-review diff · run `pnpm lint typecheck test` · screenshots/GIF for UI · note risky areas · keep PR small.

## Etiquette

Comment with intent (`nit:`, `question:`, `blocking:`); prefer suggestions; approve with "LGTM + notes" when only nits remain; resolve threads by the author after addressing. Turnaround ≤ 1 business day.
