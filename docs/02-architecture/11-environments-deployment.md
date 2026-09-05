# 11 · Environments, Configuration & Deployment

| Field   | Value                                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Approved with assumptions (hosting not final)                                                                                                                                                      |
| Source  | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §12.3, §25 · [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §1.5, §12 |
| Related | [../06-engineering/06-environment-variables.md](../06-engineering/06-environment-variables.md) · [../06-engineering/07-ci-cd.md](../06-engineering/07-ci-cd.md)                                    |

## 1. Environments

| Env          | Purpose        | Web                                   | API/worker                                  | DB & Auth                                                                         | Providers                                                       | Data            |
| ------------ | -------------- | ------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------- |
| `local`      | dev            | `next dev` :3000                      | `nest start --watch` :4000 (`APP_ROLE=all`) | Docker Postgres :5432 (or `supabase start`) + Supabase local/dev project for auth | `PROVIDERS_MODE=fake` default; real with personal keys optional | seed + fixtures |
| `staging`    | QC, UAT, perf  | Vercel preview/prod project `staging` | host service `api-staging`                  | Supabase project `how-about-me-staging` (Free → Pro if needed)                    | real Threads test app/token, real OpenAI with low budget        | seeded + real   |
| `production` | internal users | Vercel prod                           | host service `api-prod` (1 instance MVP)    | Supabase Pro `how-about-me-prod`                                                  | production Meta app/token, OpenAI prod key                      | real            |

Rules: never test destructive/backfill logic against production first; each env has its own secrets; staging mirrors prod config shape.

## 2. Hosting assumptions (owner to confirm)

- Web: Vercel (zero-config Next.js). Alternative: same Node host as API.
- API/worker: a persistent Node host (Railway / Fly.io / Render / a small VM with Docker). Requirements: always-on process (scheduler), outbound HTTPS, env secrets, logs, health checks (`/health/ready`), ≥ 512 MB RAM.
- Docker image `apps/api/Dockerfile` (multi-stage, `node:24-alpine`, `pnpm deploy --filter api`), runs `prisma migrate deploy` then `node dist/main.js`.

## 3. Supabase setup per environment

1. Create project (region Singapore `ap-southeast-1` for VN latency).
2. Auth: disable public sign-ups; enable Email (password) ± Google; set Site URL and redirect URLs (web origin).
3. Database: copy `DATABASE_URL` (pooler, transaction mode, port 6543, `?pgbouncer=true&connection_limit=10`) and `DIRECT_URL` (port 5432) for migrations.
4. Create a dedicated DB role for the API? (MVP: use `postgres` role via pooler; P1 hardening: least-privilege role.)
5. Backups: Pro daily; PITR optional.
6. Record project refs in the environment secret store (not in repo).

## 4. Configuration model

- All config via env vars validated by Zod at boot (`apps/api/src/config/env.schema.ts`, `apps/web/src/lib/env.ts`).
- `.env.example` files are the documentation; real `.env` files are git-ignored.
- Web public vars are `NEXT_PUBLIC_*` only (URL, anon key, API base). Everything else is server-side.

## 5. CI/CD flow (summary; details in engineering handbook)

```text
PR → CI (lint, typecheck, unit+integration, build, secret scan)
merge to develop → deploy staging (web + api), run migrations, Playwright smoke
release/x.y.z → tag → merge to main → deploy production (manual approval), migrations, smoke
```

## 6. Release & rollback

- Versioning: semver tags `v0.x.y` (MVP `v0.1.0` at M5). Changelog generated from conventional commits.
- Rollback: redeploy previous image/tag; migrations are additive within a release; destructive migrations only in a dedicated release with backup + approval.
- Feature flags (env-based) for P1 features: `FEATURE_OVERRIDES`, `FEATURE_EXPORT`, `FEATURE_BACKFILL_UI`.

## 7. Operational readiness (before production)

- [ ] Staging soak: scheduler running ≥ 5 days, no duplicates, failures visible
- [ ] Alerts wired (doc 09 §5)
- [ ] Runbook reviewed ([../05-operations/02-runbook.md](../05-operations/02-runbook.md))
- [ ] Backups verified · [ ] Secrets separated · [ ] Meta terms/retention reviewed
