# ADR-0006 · Official Threads API only, behind `SocialDiscoveryProvider`

**Status:** Accepted · **Date:** 2026-09-05

## Context

Compliance requires official API access; the highest product risk is source-data availability; future platforms (X, Reddit…) are planned.

## Decision

All discovery goes through `SocialDiscoveryProvider`; the only implementation in MVP is `ThreadsDiscoveryProvider` (keyword/tag search, pagination, error mapping, rate-limit metadata). No scraping. Provider DTOs never leave `ThreadsModule`. Fixtures recorded in the POC back a `FakeThreadsProvider` for tests/local.

## Consequences

- API changes and new platforms are isolated; testable without network.
  − Feature set bounded by API (reply trees not promised); POC (M1) is a hard gate.

## Alternatives

Scraping (violates terms, brittle) · third-party aggregators (cost, less control).
