# ADR-0002 · Next.js App Router + Untitled UI (React Aria, Tailwind v4)

**Status:** Accepted · **Date:** 2026-09-05

## Context

Stack fixed by requirements: Next.js, TypeScript, Tailwind, Untitled UI React. Untitled UI ships an official Next.js starter (CLI `untitledui init --nextjs`) built on React Aria Components and Tailwind v4.

## Decision

Use the Untitled UI Next.js starter as the base of `apps/web` (components vendored under `src/components`, tokens in `src/styles/theme.css`). App Router with route groups `(public)` and `(app)`. TanStack Query for server state; `nuqs` for URL filters; Recharts via Untitled UI chart wrappers.

## Consequences

- Accessible primitives out of the box; consistent design tokens; official upgrade path (`untitledui upgrade`).
  − Vendored components must be kept close to upstream; PRO components may need a licence (assumed not required).

## Alternatives

shadcn/ui (not the mandated system) · Vite SPA (loses SSR auth redirect and Vercel fit).
