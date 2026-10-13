# 01 · Local Setup

## Prerequisites

| Tool                    | Version             | Notes                                                    |
| ----------------------- | ------------------- | -------------------------------------------------------- |
| Node.js                 | 24.x (see `.nvmrc`) | `nvm use`                                                |
| pnpm                    | 10.x                | `corepack enable` or `npm i -g pnpm@10`                  |
| Docker Desktop          | latest              | Postgres for local/API tests                             |
| Git                     | ≥ 2.40              |                                                          |
| (optional) Supabase CLI | latest              | only if you prefer `supabase start` over Docker Postgres |

## 1. Clone & install

```bash
git clone git@github.com:mryesss97/how-about-me.git
cd how-about-me
nvm use
pnpm install
```

Husky hooks install automatically (`prepare`).

## 2. Environment files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill the values marked `# REQUIRED` (see [06-environment-variables.md](06-environment-variables.md)). For a first run you only need the database URL and Supabase URL/anon key; providers default to `PROVIDERS_MODE=fake`.

## 3. Database

```bash
pnpm db:up            # docker compose up -d postgres
pnpm db:migrate       # prisma migrate dev (apps/api)
pnpm db:seed          # project, admin (SEED_ADMIN_EMAIL), 4 queries
```

`db:seed` is idempotent: re-running never duplicates rows and never overwrites project name/timezone/settings edited in the UI, but it forces the `SEED_ADMIN_EMAIL` member back to `admin`.

Reset: `pnpm db:reset`.

The container's init script (`docker/postgres/init/01-test-db.sql`) also creates `how_about_me_test`, the database the API integration tests use. It runs only on a fresh `pgdata` volume; on an older volume create it by hand: `docker exec how-about-me-postgres createdb -U postgres how_about_me_test`.

macOS: the repo must sit under a path Docker Desktop shares. `/Users` is shared by default, `/Applications` is not. If the repo lives in `/Applications/...`, `pnpm db:up` fails with `Mounts denied: The path …/docker/postgres/init is not shared from the host`. Fix: Docker Desktop → Settings → Resources → File sharing → add the repo's parent folder (e.g. `/Applications/Nobilabs`) → Apply & restart, then run `pnpm db:up` again.

## 4. Run

```bash
pnpm dev              # turbo: web http://localhost:3000, api http://localhost:4000 (Swagger /api/docs)
```

Log in with the Supabase user matching `SEED_ADMIN_EMAIL` (create the user in your Supabase project's Auth dashboard, or use `pnpm --filter api seed:auth-user` when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; it creates a confirmed user with `SEED_ADMIN_PASSWORD` or sends an invite when that is empty, and skips with exit 0 when keys are missing; it reads `apps/api/.env`). Order: `db:seed` → `seed:auth-user` → log in; the placeholder profile is re-keyed to the auth user id on first login.

With `PROVIDERS_MODE=fake` the collector ingests fixtures and the analyzer produces deterministic labels, so the dashboard has data within a minute.

## 5. Useful scripts

| Command                                                     | What                                                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | all workspaces via Turborepo                                                                                                                 |
| `pnpm test:int`                                             | API integration tests: builds `packages/*`, then Jest + Supertest on Docker Postgres (`pnpm db:up` first)                                    |
| `pnpm test:int:quiet`                                       | Same, log in `.git/worktrees/<name>/test-int.log`; one line on pass, last 50 lines on fail; failures kept as `test-int-<UTC>.log` (5 newest) |
| `pnpm --filter @how-about-me/web e2e`                       | Playwright                                                                                                                                   |
| `pnpm db:studio`                                            | Prisma Studio                                                                                                                                |
| `pnpm issues:sync`                                          | create/update GitHub issues from `docs/03-delivery/backlog.json` (needs `gh auth`)                                                           |
| `npx untitledui@latest add <component> --dir apps/web`      | add an Untitled UI component                                                                                                                 |

## 6. Troubleshooting

- Prisma "prepared statement already exists" → ensure `DATABASE_URL` has `?pgbouncer=true` when using Supabase pooler; locally use direct Postgres.
- Port in use → `PORT=4001 pnpm --filter @how-about-me/api dev`.
- `pnpm db:up` → `Mounts denied … is not shared from the host` → add the repo's parent folder to Docker Desktop File sharing (see §3).
- `test:int` → `Cannot find module '@how-about-me/contracts'` → run it from the root (`pnpm test:int`) so Turborepo builds `packages/*` first, or `pnpm build` once.
- `test:int` fails once, then passes on rerun → check the kept `test-int-<UTC>.log` from `pnpm test:int:quiet`. Each worktree uses its own DB `how_about_me_test_<hash>` (#189); drop stale ones with `docker compose exec postgres psql -U postgres -c 'DROP DATABASE how_about_me_test_<hash>'` (list them with `\l`).
- `test:int` → `Must use import to load ES Module: …/jose/…` → the Jest config compiles `jose` to CJS; if you see this, a new ESM-only dependency needs adding to `transformIgnorePatterns` in `apps/api/jest.config.ts` (see [testing strategy §9](../02-architecture/10-testing-strategy.md#9-running-the-api-integration-suite)).
- Husky hook fails on commit message → follow [04-git-workflow.md §4](04-git-workflow.md#4-commit-messages-conventional-commits).
