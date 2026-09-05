# Architecture Decision Records

Format: Context → Decision → Consequences → Alternatives. Status: Proposed / Accepted / Superseded. New ADRs get the next number; never edit an accepted ADR's decision — supersede it.

| #                                                  | Title                                                                           | Status   |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| [0001](0001-monorepo-pnpm-turborepo.md)            | Monorepo with pnpm workspaces + Turborepo                                       | Accepted |
| [0002](0002-nextjs-app-router-untitled-ui.md)      | Next.js App Router + Untitled UI (React Aria, Tailwind v4)                      | Accepted |
| [0003](0003-nestjs-rest-api.md)                    | NestJS REST API (`/api/v1`) with Zod contracts                                  | Accepted |
| [0004](0004-supabase-postgres-prisma.md)           | Supabase Postgres + Auth, Prisma ORM, business logic in NestJS                  | Accepted |
| [0005](0005-postgres-first-no-queue-infra.md)      | Postgres-first jobs & search; no Redis/Kafka/OpenSearch in MVP                  | Accepted |
| [0006](0006-official-api-only-provider-adapter.md) | Official Threads API only, behind `SocialDiscoveryProvider`                     | Accepted |
| [0007](0007-ai-provider-abstraction.md)            | AI providers behind `SafetyProvider` / `ContentClassifier`; models configurable | Accepted |
| [0008](0008-versioned-analysis-runs.md)            | Append-only, versioned analysis runs with effective pointer                     | Accepted |
| [0009](0009-three-state-relevance.md)              | Three-state relevance and default exclusion of `irrelevant`                     | Accepted |
| [0010](0010-gitflow-conventional-commits.md)       | Gitflow branching + conventional commits + semver                               | Accepted |
| [0011](0011-utc-storage-project-timezone.md)       | UTC storage, project/user timezone for display & bucketing                      | Accepted |
| [0012](0012-encrypted-provider-tokens.md)          | Provider tokens encrypted at rest with key rotation                             | Accepted |
