# 03 · Coding Conventions

## 1. General (TypeScript)

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes` off (Prisma compat).
- No `any`; use `unknown` + narrowing. `// eslint-disable-next-line` requires a reason.
- Prefer `type` for data shapes, `interface` for extensible contracts (providers).
- Enums as `const` objects + union types (from `packages/contracts`), not TS `enum` (Prisma enums mapped at repository boundary).
- Errors: throw `AppError` (api) / `ApiError` (web); never throw strings.
- Dates: `Date` in memory, ISO strings on the wire, `timestamptz` in DB. Use `date-fns` / `date-fns-tz`; never `moment`.
- Immutability by default (`readonly`, spread); no mutation of function args.
- Files & folders **kebab-case**; classes/types PascalCase; functions/vars camelCase; constants UPPER_SNAKE only for env/config keys.
- Import order (Prettier plugin): react → external → `@how-about-me/*` → `@/` aliases → relative.
- Business rules referenced in code comments: `// BR-007 exclude terms post-ingestion`.

## 2. NestJS (`apps/api`)

- One module per bounded context (doc 02). Files: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `dto/` (re-export from contracts), `__fixtures__/`, `*.spec.ts`.
- Controllers: thin; validate with `ZodValidationPipe`; decorate roles `@Roles('admin')`; return contract DTOs; never return Prisma models.
- Services: business logic & transactions; inject repositories/providers via interfaces (`@Inject(SAFETY_PROVIDER)` tokens).
- Repositories: only place that imports `@prisma/client`; map to domain/DTO types.
- Raw SQL: `Prisma.sql` tagged templates; parametrised; result parsed with Zod.
- Logging: inject `PinoLogger`; include ids; no string concatenation of objects.
- Config: only via typed `AppConfig` (Zod-validated); no `process.env` outside `config/`.
- Tests: `*.spec.ts` unit next to file; `test/integration/**.int-spec.ts` with real Postgres; Supertest for HTTP.

## 3. Next.js / React (`apps/web`)

- Server Components by default; add `"use client"` only for interactivity/hooks.
- Feature-first folders (doc 03 FE); components < 200 lines; hooks in `use-*.ts`.
- Data: TanStack Query hooks per feature (`use-overview-query.ts`); keys from `lib/query/keys.ts`; no fetch in components.
- URL state via `nuqs` parsers in `lib/filters`.
- Untitled UI: import React Aria as `Aria*`; use `cx` util; theme tokens (no raw hex).
- Accessibility: labels, `aria-*`, keyboard handlers on custom interactive elements.
- Copy in `copy.ts` per feature (no inline strings for user-facing text where reusable).
- Tests: Vitest + Testing Library; `*.test.tsx` co-located.

## 4. Contracts (`packages/contracts`)

- One file per resource: `listening-queries.ts`, `mentions.ts`, `analytics.ts`, …; export `XSchema` (Zod) and `type X = z.infer<...>`.
- Query-param schemas coerce arrays/comma lists; date strings validated as ISO.
- Error codes in `errors.ts` as `const`.
- Breaking change = new major API path; add tests with snapshot fixtures.

## 5. Database (Prisma)

- Model names PascalCase singular, `@@map("snake_case_plural")`; fields camelCase with `@map`.
- Migrations named `YYYYMMDDHHMM_<slug>`; hand-edited SQL allowed for partial indexes/views/functions with comments.
- Never `prisma db push` outside local; never edit an applied migration.

## 6. Formatting & linting

Prettier (`printWidth 120`, 2 spaces, double quotes, trailing commas). Untitled UI vendored components (`apps/web/src/components/**`, `src/styles/**`) keep upstream formatting and are excluded via `.prettierignore` and lint ignores so `untitledui upgrade` diffs stay clean. ESLint flat configs from `@how-about-me/eslint-config` (`base`, `nest`, `next`). `lint-staged` runs Prettier + ESLint on staged files.

## 7. Comments & docs

- JSDoc on exported functions of packages and services with non-obvious behaviour.
- Link docs: `@see docs/02-architecture/06-ingestion-pipeline.md#4-window-calculation-fr-072`.
- TODOs: `// TODO(#issue): …` only.
