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

Reset: `pnpm db:reset`.

## 4. Run

```bash
pnpm dev              # turbo: web http://localhost:3000, api http://localhost:4000 (Swagger /api/docs)
```

Log in with the Supabase user matching `SEED_ADMIN_EMAIL` (create the user in your Supabase project's Auth dashboard, or use `pnpm --filter api seed:auth-user` when `SUPABASE_SERVICE_ROLE_KEY` is set).

With `PROVIDERS_MODE=fake` the collector ingests fixtures and the analyzer produces deterministic labels, so the dashboard has data within a minute.

## 5. Useful scripts

| Command                                                     | What                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | all workspaces via Turborepo                                                       |
| `pnpm --filter @how-about-me/api test:int`                  | API integration tests (needs Docker Postgres)                                      |
| `pnpm --filter @how-about-me/web e2e`                       | Playwright                                                                         |
| `pnpm db:studio`                                            | Prisma Studio                                                                      |
| `pnpm issues:sync`                                          | create/update GitHub issues from `docs/03-delivery/backlog.json` (needs `gh auth`) |
| `npx untitledui@latest add <component> --dir apps/web`      | add an Untitled UI component                                                       |

## 6. Troubleshooting

- Prisma "prepared statement already exists" → ensure `DATABASE_URL` has `?pgbouncer=true` when using Supabase pooler; locally use direct Postgres.
- Port in use → `PORT=4001 pnpm --filter @how-about-me/api dev`.
- Husky hook fails on commit message → follow [04-git-workflow.md §4](04-git-workflow.md#4-commit-messages-conventional-commits).
