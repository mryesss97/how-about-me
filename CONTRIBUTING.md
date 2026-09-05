# Contributing

1. Pick an issue (`[T-###] …`) that meets the Definition of Ready ([docs/03-delivery/05-definition-of-ready-done.md](docs/03-delivery/05-definition-of-ready-done.md)). Read the linked docs first.
2. Branch from `develop`: `git switch -c feature/<issue>-<slug> develop` (or `fix/`, `spike/`, `chore/`, `docs/`).
3. Code per [docs/06-engineering/03-coding-conventions.md](docs/06-engineering/03-coding-conventions.md). Reference business rules in comments (`// BR-007`).
4. Commit with Conventional Commits (`feat(collector): compute search window (#71)`). Hooks run lint-staged and commitlint.
5. Run `pnpm ci:local` before pushing.
6. Open a PR to `develop` using the template; link the issue (`Closes #<n>`); attach evidence; update docs in the same PR when behaviour changes.
7. Address review within a day; squash-merge after ≥ 1 approval and green CI.
8. Notify the linked QC issue for verification on staging.

Release and hotfix flows: [docs/06-engineering/04-git-workflow.md](docs/06-engineering/04-git-workflow.md). Code review checklist: [docs/06-engineering/05-code-review-guideline.md](docs/06-engineering/05-code-review-guideline.md).
