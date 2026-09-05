# CLAUDE.md — guidance for AI coding assistants working in this repo

## What this is

Monorepo for **How About Me**, an internal Threads social-listening product (MVP). Docs in `docs/` are the source of truth; read the relevant doc before changing behaviour and update it in the same change.

## Layout & commands

- `apps/web` Next.js 16 (App Router) + Untitled UI (React Aria, Tailwind v4) + TanStack Query. `apps/api` NestJS 11 + Prisma 6 (Postgres/Supabase). `packages/contracts` Zod DTOs shared by both. `packages/taxonomy` classification labels/policy.
- `pnpm dev | build | lint | typecheck | test`, `pnpm db:up|migrate|seed`, `pnpm backlog:render`, `pnpm issues:sync`.
- Untitled UI components live in `apps/web/src/components/**` (vendored, kebab-case files, React Aria imports prefixed `Aria*`). Add more with `npx untitledui@latest add <name> --dir apps/web`. Their upstream agent guide is in `apps/web/UNTITLED_UI_GUIDE.md`.

## Non-negotiable rules

- Never put Supabase service-role key, Threads token or OpenAI key in `apps/web` or in logs/fixtures. Only `NEXT_PUBLIC_*` reaches the browser.
- Every mutating API route declares `@Roles(...)`; authorization is enforced server-side (FR-015). FE hiding is UX only.
- Inputs validated with Zod schemas from `@how-about-me/contracts`; error responses use the `{ error: { code, message, requestId } }` envelope with codes from `contracts/errors.ts`.
- Business rules are numbered `BR-xxx` (docs/01-product/06-business-rules-glossary.md) — reference them in code comments and tests.
- Posts are unique on `(platform, platform_post_id)`; analysis results are append-only and versioned; analytics count `DISTINCT post_id` and exclude `irrelevant` by default; sentiment ≠ safety.
- Timestamps in UTC; analytics buckets in the requested timezone (default `Asia/Ho_Chi_Minh`).
- Prisma types stay in `apps/api`; repositories map to contract DTOs. Raw SQL via `Prisma.sql` tagged templates only.
- Conventional commits; branches `feature/<issue>-<slug>` from `develop`; PRs reference `Closes #<n>`.

## Where to look

- Requirements: `docs/01-product/04-functional-requirements.md`, metrics `07-metric-definitions.md`, taxonomy `08-taxonomy-classification.md`, UX `09-ux-specification.md`.
- Architecture: `docs/02-architecture/*` (backend 02, frontend 03, data model 04, API 05, ingestion 06, analysis 07).
- Task list: `docs/03-delivery/backlog.json` (→ GitHub issues `[T-###]`).
