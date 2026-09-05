# 04 · Git Workflow (Gitflow) & Conventions

Decision record: [ADR-0010](../02-architecture/adr/0010-gitflow-conventional-commits.md).

## 1. Branches

| Branch                                                | Purpose                                                   | Deploys to         | Protected                                        |
| ----------------------------------------------------- | --------------------------------------------------------- | ------------------ | ------------------------------------------------ |
| `main`                                                | production code; every commit is a release (tag `vX.Y.Z`) | production         | yes: PR, 1 review, CI, CODEOWNERS, no force-push |
| `develop`                                             | integration; always deployable to staging                 | staging            | yes: PR, 1 review, CI                            |
| `feature/<issue>-<slug>`                              | one issue                                                 | preview (optional) | —                                                |
| `fix/<issue>-<slug>`                                  | bug fix targeting develop or release                      | —                  | —                                                |
| `release/vX.Y.Z`                                      | stabilisation before prod                                 | staging            | yes (CI)                                         |
| `hotfix/vX.Y.Z`                                       | urgent prod fix from `main`                               | production         | yes                                              |
| `chore/<slug>`, `docs/<slug>`, `spike/<issue>-<slug>` | tooling/docs/POC                                          | —                  | —                                                |

Examples: `feature/71-collector-window-calculator`, `fix/143-growth-new-state`, `spike/12-threads-poc`.

## 2. Flow

```text
develop ──▶ feature/123-x ──PR (squash)──▶ develop ──▶ release/v0.1.0 ──PR (merge)──▶ main (tag v0.1.0)
                                                             └──────────── back-merge ───▶ develop
main ──▶ hotfix/v0.1.1 ──PR──▶ main (tag) ──▶ back-merge develop
```

1. Create branch from `develop` (`git switch -c feature/123-slug develop`).
2. Commit with conventional messages; push; open PR to `develop` using the template; link issue (`Closes #123`).
3. CI must pass; 1 approval; squash-merge (PR title becomes the commit → must be conventional).
4. Release: `release/vX.Y.Z` from `develop`; only fixes; QC regression; PR to `main` with merge commit; tag; back-merge to `develop`.
5. Hotfix: from `main`; PR to `main`; tag patch; back-merge.

## 3. Pull requests

- Small (< 400 LOC diff preferred); one issue per PR.
- Template sections: Summary · Issue · Docs updated · Screenshots · Test evidence · Checklist.
- Draft PRs welcome for early feedback.
- Reviewers: CODEOWNERS auto-request; author cannot approve own PR.
- Merge strategy: squash to `develop`; merge commit for release/hotfix into `main`.

## 4. Commit messages (Conventional Commits)

`<type>(<scope>): <subject>` — types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`, `revert`. Scopes: `web`, `api`, `contracts`, `taxonomy`, `collector`, `analysis`, `analytics`, `mentions`, `queries`, `auth`, `infra`, `docs`.
Examples: `feat(collector): compute search window with overlap (#71)` · `fix(web): show "New" when previous period is zero (#143)`. Body explains why; footer `Closes #71`, `BREAKING CHANGE:` when applicable. Enforced by commitlint (husky `commit-msg`).

## 5. Versioning & changelog

Semver; MVP = `v0.1.0`; P1 = `v0.2.0`. `CHANGELOG.md` generated from commits at release time (`pnpm release:notes`).

## 6. Branch protection (to apply on GitHub — admin)

- `main`: require PR, 1 approval, status checks `ci / lint-typecheck`, `ci / test`, `ci / build`, require branches up to date, include admins, restrict force-push & deletion.
- `develop`: require PR, 1 approval, same checks.
- Auto-delete head branches after merge.

## 7. Hygiene

Rebase feature branches on `develop` before requesting review; no merge commits in feature branches; delete branches after merge; never commit `.env*` (pre-commit gitleaks).
