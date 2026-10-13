# 07 · CI / CD

## 1. Workflows (`.github/workflows/`)

| Workflow                | Trigger                                                      | Jobs                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                | PR to `develop`/`main`/`release/*`, push to `develop`/`main` | `lint-typecheck` (turbo lint + typecheck), `test` (unit + API integration with Postgres service), `build` (turbo build; FE secret scan `--build-env`), `security` (`pnpm audit:check` high+ with allowlist, gitleaks) |
| `deploy-staging.yml`    | push to `develop`                                            | build API image → deploy to host (staging) → `prisma migrate deploy` → web deploy (Vercel Git integration or CLI) → Playwright smoke                                                                                  |
| `deploy-production.yml` | tag `v*` on `main`                                           | same with manual approval environment `production`                                                                                                                                                                    |
| `labels.yml`            | change to `.github/labels.yml`                               | sync labels                                                                                                                                                                                                           |
| `nightly.yml`           | schedule 02:00 UTC                                           | Playwright e2e against staging (no audit; it runs in `ci.yml` job `security`)                                                                                                                                         |

Deploy jobs are scaffolded with placeholders for the hosting provider (decision pending — see risk R14); they fail fast with a clear message until secrets are configured.

## 1.1 Manual dispatch & current status (2026-09-05)

`ci.yml` supports `workflow_dispatch` (`gh workflow run ci.yml -R mryesss97/how-about-me --ref <branch>`). The first dispatched run on `main` passed all four jobs (lint-typecheck, test with Postgres service + migrations, build + FE secret scan, security). **Event-triggered runs (push / pull_request) did not start on this repository at scaffold time** although Actions are enabled; the owner is checking repository Actions and billing settings (see the comment on the T-003 issue). Branch protection (T-002) depends on event-triggered checks.

## 1.2 `test` job

Steps: install → `prisma generate` → `db:deploy` on the Postgres service → migration drift check (`psql` creates `how_about_me_shadow` on the same service, then `pnpm --filter @how-about-me/api db:drift` with `SHADOW_DATABASE_URL`; fails when `prisma/migrations` and `schema.prisma` differ, see [data model](../02-architecture/04-data-model.md)) → `pnpm test:cov` (unit, all workspaces; coverage for `apps/api` and `apps/web`) → `pnpm test:int` (API integration: Jest + Supertest against the same service, `TEST_DATABASE_URL` from the job env). Integration tests run in CI since 2026-10-13 (#137); before that the job only ran unit tests. After the tests, `scripts/coverage-summary.mjs` writes a coverage table (from each `coverage/coverage-summary.json`) to the job step summary and `lcov.info` is uploaded as the `coverage` artifact. No minimum threshold yet (T-003: report only). Details: [testing strategy §9](../02-architecture/10-testing-strategy.md#9-running-the-api-integration-suite).

## 1.3 `security` job

1. `pnpm audit:check` runs `pnpm audit --prod` and blocks any high/critical advisory not in `.audit-allowlist.json` or whose entry has expired (process: `docs/02-architecture/08-security-secrets.md` §9).
2. `gitleaks` scans for secrets.

State at #149 (2026-10-13): `next` 16.3.8; root `package.json` `pnpm.overrides` force fixed versions of transitive deps using range selectors (`pkg@<fixed`): `multer@<2.4.0`, `proxy-addr@<2.0.8`, `sharp@<0.35.5`, `postcss@<8.5.23`, `brace-expansion@<1.1.21`, `brace-expansion@>=4.0.0 <5.0.12`, `source-map-js@<1.2.2`, `deepmerge-ts@<8.0.0` (major bump; Prisma 6 pins 7.1.5). The allowlist holds only `braces` GHSA-vfj7-8cjw-p6xm (no patch, ESLint tooling only), expiring 2027-01-11.

When upstream ships a fix: remove the allowlist entry; remove an override once every dependent resolves the fixed version on its own (range selectors are already a no-op then).

## 2. Required checks

`ci / lint-typecheck`, `ci / test`, `ci / build` on `develop` and `main`.

## 3. Caching

pnpm store cache (`actions/setup-node` with `cache: pnpm`), Turborepo remote cache optional (Vercel) — local `.turbo` cache in CI via `actions/cache`.

## 4. Secrets in GitHub

`STAGING_*` / `PRODUCTION_*` environment secrets: API host token, `DATABASE_URL`/`DIRECT_URL` (for migrations), Vercel token/org/project (if CLI deploy). Web build env comes from Vercel project settings. Never store provider keys in GitHub if the host injects them.

## 5. Release automation

`pnpm release:notes` (conventional-changelog) → CHANGELOG section; tag pushed by release manager triggers production deploy.

## 6. Local parity

`pnpm ci:local` runs the same steps as `ci.yml` (lint, typecheck, test, build, `audit:check`) for pre-push confidence. It skips the API integration tests because they need Postgres: run `pnpm db:up && pnpm test:int` separately.
