# 05 · Definition of Ready / Definition of Done

## Definition of Ready (a story/task can be pulled into a sprint)

- [ ] Issue exists with the template filled: context, docs links, scope, acceptance criteria.
- [ ] Linked to an epic, milestone, priority label, area label.
- [ ] Dependencies identified and not blocking (or explicitly sequenced).
- [ ] Design/UX reference available (UX spec section) for FE tasks.
- [ ] API contract section exists for BE/FE integration tasks.
- [ ] Estimated (S ≤ 1 d, M ≤ 3 d, L ≤ 5 d); L tasks split when possible.
- [ ] QC understands how it will be verified (test-case file/section named).

## Definition of Done (engineering task)

- [ ] Code merged to `develop` via PR with ≥ 1 approval and green CI.
- [ ] Unit tests for logic; integration tests for persistence/HTTP behaviour; coverage not decreased.
- [ ] Contracts (`packages/contracts`) updated when API shape changes; OpenAPI regenerated.
- [ ] Docs updated in the same PR (FR/API/data model/runbook as applicable); ADR added for architectural decisions.
- [ ] Observability: logs/metrics/audit added where the doc requires.
- [ ] Security: no secrets, validation on inputs, role decorators on mutations.
- [ ] Feature works on staging with real or fake providers as specified; screenshots/GIF in PR for UI.
- [ ] Issue closed by PR with `Closes #n`; QC issue notified.

## Definition of Done (QC task)

- [ ] Test cases written/updated in `docs/04-qa/test-cases/` with IDs and steps.
- [ ] Executed on staging; results recorded (pass/fail, build sha, date) in the issue.
- [ ] Bugs filed with template and linked; severity assigned.
- [ ] Analytics reconciliation performed for metric-related features.
- [ ] Sign-off comment on the engineering issue.

## Definition of Done (milestone)

- [ ] All P0 issues in the milestone closed or explicitly moved with owner approval.
- [ ] Milestone gate criteria (timeline doc) verified and recorded in a review note.
- [ ] Risks register updated.
- [ ] Demo delivered to owner.
