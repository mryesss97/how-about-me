# 02 · Monorepo Structure

```text
how-about-me/
├─ apps/
│  ├─ web/                      Next.js 16 (App Router) · Untitled UI · TanStack Query    → @how-about-me/web
│  └─ api/                      NestJS 11 · Prisma 6 · scheduler/worker                    → @how-about-me/api
├─ packages/
│  ├─ contracts/                Zod schemas, DTO types, enums, error codes (FE+BE)         → @how-about-me/contracts
│  ├─ taxonomy/                 taxonomy v1 labels/guides, safety policy v1, versions      → @how-about-me/taxonomy
│  ├─ eslint-config/            shared flat ESLint configs (base, nest, next)              → @how-about-me/eslint-config
│  └─ tsconfig/                 shared tsconfig bases                                       → @how-about-me/tsconfig
├─ docs/                        this documentation set
├─ scripts/                     repo tooling (issues sync, FE secret check)
├─ tools/perf/                  k6 scripts (M5)
├─ .github/                     workflows, issue/PR templates, CODEOWNERS, labels
├─ docker-compose.yml           local Postgres
├─ turbo.json · pnpm-workspace.yaml · package.json · .nvmrc · .editorconfig · .prettierrc
├─ commitlint.config.cjs · .husky/ · lint-staged config in package.json
├─ CLAUDE.md                    guidance for AI coding assistants (conventions summary)
└─ README.md · CONTRIBUTING.md · CHANGELOG.md
```

## Dependency rules

- `apps/*` may depend on `packages/*`; packages never depend on apps.
- `contracts` depends only on `zod`; `taxonomy` has no runtime deps.
- `web` must not import from `api` (and vice-versa); enforced via ESLint `no-restricted-imports` + separate tsconfig paths.
- Prisma types stay inside `apps/api` (repositories map to contract DTOs).

## Package scripts (every workspace)

`dev`, `build`, `lint`, `typecheck`, `test` (+ `test:int`, `e2e` where relevant), `clean`. Turborepo pipelines in `turbo.json` cache `build`, `lint`, `typecheck`, `test`.

## Versioning

Single version for the product (`package.json` root `version`), tags `vX.Y.Z`. Packages are private (`workspace:*`), not published.
