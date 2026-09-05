# ADR-0003 · NestJS REST API with Zod contracts

**Status:** Accepted · **Date:** 2026-09-05

## Context

BE mandated as NestJS/TypeScript with REST for MVP. FE and BE need one source of truth for request/response shapes.

## Decision

NestJS 11 modular monolith exposing `/api/v1` REST. DTOs defined once as Zod schemas in `packages/contracts` and used by a `ZodValidationPipe` server-side and by the typed FE client. OpenAPI generated from the same schemas for documentation. Same build runs as `api`, `worker`, or `all` via `APP_ROLE`.

## Consequences

- Single contract, runtime validation, typed client. + One deployable simplifies MVP ops; roles allow later split.
  − Zod↔Swagger bridging needs a small adapter; no GraphQL flexibility (not needed).

## Alternatives

class-validator DTOs (duplicated types for FE) · tRPC (couples FE to Nest internals, harder for non-TS consumers) · GraphQL (overkill).
