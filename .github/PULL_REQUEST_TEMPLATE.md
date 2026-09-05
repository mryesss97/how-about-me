## Summary

<!-- What and why, in 2–4 sentences. -->

## Issue

Closes #

## Docs updated

- [ ] N/A — no behaviour/contract change
- [ ] Updated: <!-- docs/... -->

## Screenshots / evidence

<!-- UI: before/after or GIF. API: sample request/response. Jobs: log excerpt (redacted). -->

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
