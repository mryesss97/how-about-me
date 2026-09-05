# ADR-0011 · UTC storage, project/user timezone for display & bucketing

**Status:** Accepted · **Date:** 2026-09-05

## Context

Analysts reason in Vietnam local time; data comes with UTC timestamps; buckets and previous-period boundaries must align to local days.

## Decision

All DB timestamps `timestamptz` (UTC). API accepts/returns ISO-8601 with offsets. Analytics accept `timezone` (default project timezone `Asia/Ho_Chi_Minh`) and bucket with `AT TIME ZONE`; previous period computed in that timezone. `published_at` is the analytical time field.

## Consequences

- Correct local-day analytics; portable to other regions. − Every analytics query must be tz-aware (covered by tests).
