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
- Template sections: Summary · Issue · Docs updated · Screenshots · Test evidence · Checklist · Definition of Done.
- `pnpm pr:create` refuses a body without the `## Definition of Done` section (except `release/*`). `pnpm issue:ship` writes it (§8); a PR opened by hand fills the one in the template.
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

## 8. Issue loop (agent)

Each request runs as one loop: one issue, one worktree, one PR, merge, then the next issue. Scripts run the fixed steps; the pipeline inside a ticket (triage → plan → code → review, with model choice and cost log) is in [.claude/WORKFLOW.md](../../.claude/WORKFLOW.md).

The owner adopted the live-stream-admin loop on 2026-10-13. Agents follow it for every batch of requests without being reminded:

1. **One request = one ticket.** Read the code and run the app first, so the ticket records facts. If a request is unclear, ask the owner before creating the ticket. Do clear tickets first.
2. **One ticket = one worktree**, cut from the latest `origin/develop` with `pnpm issue:start`. Never switch branch in the main checkout: other sessions share it.
3. **One ticket = one PR** that links the ticket. `pnpm issue:tidy`, commit, then `pnpm issue:ship`.
4. **Merge when green.** Once the push passed the `pre-push` hook (verify), merge with `pnpm issue:finish <PR>`: squash-merge, close the tickets in `Closes #N`, delete the branch, remove the worktree.
5. **The next ticket starts from the new `develop`.** Create its worktree only after the merge, so each PR starts from the code the previous PR shipped.

Tickets that touch the same files run one after another. Tickets in different areas may run in parallel; keep about 4 agents, because high load makes the tests in `pre-push` time out.

The loop runs continuously (owner, 2026-10-13, #140): no stop to approve the plan or the QA report. A ticket is unblocked when every `depends_on` ticket is merged into `develop`, it has no `needs: owner-input` label, and it touches different files than the tickets in flight; unblocked tickets run in parallel. QA FAIL goes back to the coder, at most 2 rounds. The agent stops and asks the owner only for owner input, a contract or data-model decision the docs do not settle, QA still failing after 2 rounds, or a red check the ticket did not cause.

Tickets the owner marks "pending" stay untouched. For an open question the owner has not answered, follow the agent's written proposal and record the decision, with the date, in a ticket comment.

| Step                                                                                                                          | Command                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Worktree `../how-about-me-<issue>` on `<type>/<issue>-<slug>` from `origin/develop`, copy env files, install                  | `pnpm issue:start <issue\|T-###> <type> <summary ≤ 5 words>`                     |
| Prettier + `eslint --fix` on changed files                                                                                    | `pnpm issue:tidy`                                                                |
| Checks, one line on pass, last 50 lines on fail                                                                               | `pnpm verify:quiet`                                                              |
| Screenshot before (on the old code) and after (on the new code)                                                               | `pnpm issue:shot <before\|after> <name> --url /<route>`                          |
| Verify, push, upload screenshots, open PR (checks branch, title, target, `Closes #n`; adds Definition of Done and agent cost) | `pnpm issue:ship --title "<subject>" --body-file <file> [--no-shots "<reason>"]` |
| Squash-merge, close the issues (`Closes #n` does not auto-close into `develop`), delete branch, remove worktree               | `pnpm issue:finish <PR>`                                                         |

The husky `pre-push` hook runs gitleaks, shellcheck and `pnpm verify` (reusing the result `issue:ship` just produced for the same commit), because Actions does not fire on push/PR in this repo yet.

### Definition of Done checked by `issue:ship`

1. `pnpm verify` passes on the pushed commit (prisma generate · format:check · lint · typecheck · unit tests · `pnpm agent:test`).
2. `pnpm test:e2e` passes, once the root declares it. Until then the section says e2e did not run.
3. A branch that changes UI files (`apps/web/src`, except tests, `__tests__`, `__mocks__` and `.md`) has a before/after screenshot pair, or `--no-shots "<reason>"` when the screen does not change.

Screenshots:

- `pnpm issue:shot before <name> --url /<route>` right after `issue:start`, before changing code; `pnpm issue:shot after <name> --url /<route>` when the change is done. A path resolves against `http://localhost:3000` (`pnpm dev`), or `SHOT_BASE_URL` when the web app runs on another port.
- Default viewport `1366x768`. Flags: `--size WxH`, `--timeout <ms>`, `--dark` (emulates an OS in dark mode and checks the app stays light, #260), and steps `--wait-text "<text>"`, `--click "<label>"`, `--scroll "<text>"` that run in order. `--file <png>` saves a shot taken another way (for example a screen that needs a signed-in session). Full table: [.claude/WORKFLOW.md](../../.claude/WORKFLOW.md#definition-of-done).
- The script drives the Playwright that `apps/web` installs for e2e (`CHROME_PATH`, then Playwright's Chromium, then a system Chrome). No extra dependency.
- PNGs stay in `.claude/runs/shots/` (gitignored). `issue:ship` commits them to the orphan branch `pr-assets`, one folder per branch, links them as `blob/pr-assets/…?raw=true` in a before/after table, and clears the folder after the PR opens.
- Do not delete `pr-assets`: merged PRs link their screenshots there. The `pre-push` hook skips pushes to it (images only, no code).

### Script tests

`pnpm agent:test` (part of `pnpm verify`) runs the tests of the workflow scripts in `scripts/`: `agent-workflow` (agent, issue, ticket helpers), `pr-done` (screenshots, Definition of Done, Chrome lookup), `pr-conventions` (branch, title, target), `merge-state`, `verify-lock` and `verify-stamp`.
