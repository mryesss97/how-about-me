## Summary

<!-- What and why, in 2–4 sentences. -->

## Issue

Closes #

## Docs updated

- [ ] N/A — no behaviour/contract change
- [ ] Updated: <!-- docs/... -->

## Screenshots / evidence

<!-- UI: the before/after table goes in Definition of Done below (`pnpm issue:shot`). API: sample request/response. Jobs: log excerpt (redacted). -->

## Test evidence

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually verified on local/staging (describe)

## Checklist

- [ ] Conventional commit title (squash merge uses it)
- [ ] No secrets in code, fixtures, logs or screenshots
- [ ] Role decorators on new mutations; Zod validation on inputs
- [ ] Business rules referenced (`BR-xxx`) where applicable
- [ ] Contracts/OpenAPI updated when API shape changed
- [ ] Prisma migration reviewed: no unintended DROP of raw-SQL objects (partial indexes, `search_vector`, view) — see docs/02-architecture/04-data-model.md §6
- [ ] QC task notified (link)

<!-- `pnpm issue:ship` replaces this section with the checked one and the screenshot table. A PR opened by hand fills it in: `pnpm pr:create` refuses a body without it. -->

## Definition of Done

- [ ] `pnpm verify` pass (hook `pre-push`).
- [ ] E2E: the root has no `test:e2e` script yet, not run.
- [ ] Screenshot before and after (`pnpm issue:shot`), or why none is needed:

| Screen | Before         | After         |
| ------ | -------------- | ------------- |
| …      | ![before](url) | ![after](url) |
