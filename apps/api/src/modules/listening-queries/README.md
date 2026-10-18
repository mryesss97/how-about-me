# listening-queries module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `listening-queries`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Files (T-042)

- `listening-queries.controller.ts` — routes of API contract §5 (list, get, create, patch, delete, restore). Mutations `@Roles("admin")`.
- `listening-queries.service.ts` — business rules + transactions + audit (BR-004…BR-010, BR-034, FR-051…FR-057).
- `listening-queries.repository.ts` — the only Prisma access; duplicate check uses `lower(query_value) = lower($1)` like the partial unique index (no ILIKE), delegated to `common/queries/find-active-query-duplicate.ts` (also used by `prisma/seed.ts`). Maps rows to the `ListeningQuery` DTO.
- `reject-immutable-fields.pipe.ts` — `400 QUERY_IMMUTABLE_FIELD` for `queryValue`/`queryType` in PATCH, before Zod strips them.
- `term-matcher.ts` — include/exclude term matching (T-044).

## Behaviour decisions

- PATCH on a soft-deleted query → 404; DELETE twice → 204 no-op; restore of an active query → 200 no-op.
- Re-enable / restore of an enabled query sets `next_run_at = now`. Known MVP gap: if a run is in flight while the query is disabled and re-enabled, `completeRun` overwrites `next_run_at` with `completedAt + interval` (delay ≤ one interval).
- `lastJob` / `matchedPosts` (T-045, FR-061): `repository.loadSyncSummaries(ids)` — one `unnest(ids)` + two LATERAL joins (newest sync_job; match counts excluding `excluded_by_terms`, last24h by `first_matched_at`). Used by list and `toDto`. Definitions in API contract §5.
- List pagination: keyset `(created_at, id) DESC` evaluated in SQL via `common/pagination/created-at-keyset.ts`; cursor = `encodeSortCursor` sort `created_desc` with the µs `created_at` key, so rows inside one millisecond are never skipped (#188).
