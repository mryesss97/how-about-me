# ADR-0008 · Append-only, versioned analysis runs with effective pointer

**Status:** Accepted · **Date:** 2026-09-05

## Context

Prompts, models, taxonomies and policies will change; re-analysis must be auditable and comparable; dashboards need one row per post.

## Decision

`analysis_runs` (execution, versions, cost, status) + `post_analyses` (result, 1:1 with run) are append-only. `social_posts.current_analysis_id` points to the latest completed result (transactionally updated). Identical `(content_hash, effective_version)` is never re-run unless forced. Overrides (P1) are a separate table overlaid via the `effective_post_analysis` view.

## Consequences

- Full history; cheap dashboards; safe re-analysis. − Storage grows with runs (acceptable; retention policy covers it).

## Alternatives

Overwrite in place (loses audit) · versions inside JSONB (hard to query).
