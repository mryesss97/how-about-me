# ADR-0001 · Monorepo with pnpm workspaces + Turborepo

**Status:** Accepted · **Date:** 2026-09-05

## Context

FE (Next.js) and BE (NestJS) share DTOs, enums and taxonomy. The team is small and wants one PR to change contract + both sides. Source doc recommends a monorepo (`apps/`, `packages/`).

## Decision

Single repository `how-about-me` with pnpm workspaces and Turborepo: `apps/web`, `apps/api`, `packages/contracts`, `packages/taxonomy`, `packages/eslint-config`, `packages/tsconfig`. Shared code is published internally as workspace packages (built with `tsup`, consumed via `workspace:*`).

## Consequences

- Atomic contract changes; one CI; shared lint/TS config; cached builds.
  − Larger repo; need discipline on package boundaries (enforced by ESLint `no-restricted-imports`). Deployments must build only the affected app (`turbo run build --filter=...`).

## Alternatives

Separate repos (contract drift, duplicated CI) · Nx (heavier than needed).
