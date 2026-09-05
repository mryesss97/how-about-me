# ADR-0004 · Supabase Postgres + Auth; Prisma ORM; business logic in NestJS

**Status:** Accepted · **Date:** 2026-09-05

## Context

Requirements fix Supabase Postgres and recommend Supabase Auth and Prisma. Browser must never hold the service-role key. Historical analytics need first-party storage.

## Decision

Supabase project per environment. Supabase Auth issues JWTs verified by NestJS. All business data flows through NestJS using Prisma 6 over the Supabase pooler (`DATABASE_URL`) with `DIRECT_URL` for migrations. No RLS-based business logic and no direct table access from the browser in MVP. Raw SQL (Prisma tagged templates) for analytics, claiming and views.

## Consequences

- Managed Postgres/Auth/backups; ORM productivity; explicit RBAC in one place.
  − Partial indexes/views/generated columns need hand-edited migrations; pooler requires `pgbouncer=true` and care with prepared statements.

## Alternatives

Direct Supabase client from FE with RLS (business logic duplication, harder audit) · Drizzle/TypeORM (team familiarity favours Prisma).
