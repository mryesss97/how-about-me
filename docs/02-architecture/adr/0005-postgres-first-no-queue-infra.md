# ADR-0005 · Postgres-first jobs & search; no Redis/Kafka/OpenSearch in MVP

**Status:** Accepted · **Date:** 2026-09-05

## Context

Expected MVP volume is small (hundreds–thousands of posts/month). Requirements explicitly defer Redis/Kafka/OpenSearch.

## Decision

Job state and claiming live in Postgres (`sync_jobs`, `analysis_runs`, `listening_queries.locked_*`, `FOR UPDATE SKIP LOCKED`). Text search uses Postgres FTS (GIN) with ILIKE fallback. Caching limited to TanStack Query and optional short in-memory TTL for overview.

## Consequences

- Zero extra infra; durable jobs across restarts; multi-instance safety.
  − Polling latency (5–60 s) instead of push; at high volume, aggregate tables (P1.5) and possibly a queue will be needed — revisit when `analysis_queue_depth` regularly > 5 000 or overview p95 > 1.5 s.

## Alternatives

BullMQ + Redis (extra service, still needs DB for state) · SQS/Kafka (operational overhead).
