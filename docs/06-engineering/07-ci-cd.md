# 07 · CI / CD

## 1. Workflows (`.github/workflows/`)

| Workflow                | Trigger                                                      | Jobs                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | PR to `develop`/`main`/`release/*`, push to `develop`/`main` | `lint-typecheck` (turbo lint + typecheck), `test` (unit + API integration with Postgres service), `build` (turbo build; FE secret scan), `security` (pnpm audit high+, gitleaks) |
| `deploy-staging.yml`    | push to `develop`                                            | build API image → deploy to host (staging) → `prisma migrate deploy` → web deploy (Vercel Git integration or CLI) → Playwright smoke                                             |
| `deploy-production.yml` | tag `v*` on `main`                                           | same with manual approval environment `production`                                                                                                                               |
| `labels.yml`            | change to `.github/labels.yml`                               | sync labels                                                                                                                                                                      |
| `nightly.yml`           | schedule 02:00 UTC                                           | Playwright e2e against staging; dependency audit                                                                                                                                 |

Deploy jobs are scaffolded with placeholders for the hosting provider (decision pending — see risk R14); they fail fast with a clear message until secrets are configured.

## 1.1 Manual dispatch & current status (2026-09-05)

`ci.yml` supports `workflow_dispatch` (`gh workflow run ci.yml -R mryesss97/how-about-me --ref <branch>`). The first dispatched run on `main` passed all four jobs (lint-typecheck, test with Postgres service + migrations, build + FE secret scan, security). **Event-triggered runs (push / pull_request) did not start on this repository at scaffold time** although Actions are enabled; the owner is checking repository Actions and billing settings (see the comment on the T-003 issue). Branch protection (T-002) depends on event-triggered checks.

## 2. Required checks

`ci / lint-typecheck`, `ci / test`, `ci / build` on `develop` and `main`.

## 3. Caching

pnpm store cache (`actions/setup-node` with `cache: pnpm`), Turborepo remote cache optional (Vercel) — local `.turbo` cache in CI via `actions/cache`.

## 4. Secrets in GitHub

`STAGING_*` / `PRODUCTION_*` environment secrets: API host token, `DATABASE_URL`/`DIRECT_URL` (for migrations), Vercel token/org/project (if CLI deploy). Web build env comes from Vercel project settings. Never store provider keys in GitHub if the host injects them.

## 5. Release automation

`pnpm release:notes` (conventional-changelog) → CHANGELOG section; tag pushed by release manager triggers production deploy.

## 6. Local parity

`pnpm ci:local` runs the same steps as `ci.yml` (lint, typecheck, test, build) for pre-push confidence.
