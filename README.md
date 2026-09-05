# How About Me — Threads Social Listening (MVP)

Internal social-listening & content-intelligence product for **Threads**: discover public posts matching configured keywords/topic tags (`1zone`, `#1zone`, `eventista`, `#eventista` by default), store them, classify them (relevance · sentiment · safety · intent · topic · language · summary) and surface trends with drill-down to every original mention.

|                      |                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docs hub**         | [docs/README.md](docs/README.md) — product, architecture, delivery, QA, operations, engineering                                               |
| **Timeline**         | [docs/03-delivery/01-milestones-timeline.md](docs/03-delivery/01-milestones-timeline.md) — MVP `v0.1.0` target **2026-11-14**                 |
| **Backlog → issues** | [docs/03-delivery/02-work-breakdown.md](docs/03-delivery/02-work-breakdown.md) · GitHub Milestones M0–M6                                      |
| **Stack**            | Next.js 16 · Untitled UI (React Aria, Tailwind v4) · NestJS 11 · Prisma 6 · Supabase (Postgres + Auth) · OpenAI Moderation + configurable LLM |

## Repository layout

```text
apps/web        Next.js app (dashboard)            @how-about-me/web
apps/api        NestJS API + scheduler/worker       @how-about-me/api
packages/       contracts (Zod) · taxonomy · eslint-config · tsconfig
docs/           documentation set (source of truth)
scripts/        backlog → WBS renderer, GitHub issue sync, FE secret check
```

## Quick start

```bash
nvm use && pnpm install
cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env.local   # fill REQUIRED values
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev        # web http://localhost:3000 · api http://localhost:4000/api/docs
```

Full guide: [docs/06-engineering/01-local-setup.md](docs/06-engineering/01-local-setup.md). With `PROVIDERS_MODE=fake` the stack runs without Meta/OpenAI credentials.

## Workflow

Gitflow (`main` → production, `develop` → staging, `feature/<issue>-<slug>`), conventional commits, PR template, CI on every PR. See [docs/06-engineering/04-git-workflow.md](docs/06-engineering/04-git-workflow.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Status

M0 foundation scaffolded (2026-09-05). Open owner inputs (Meta app, Supabase projects, classifier model/key, hosting, roster) are listed in [docs/03-delivery/02-work-breakdown.md#open-inputs-product-owner](docs/03-delivery/02-work-breakdown.md#open-inputs-product-owner).
