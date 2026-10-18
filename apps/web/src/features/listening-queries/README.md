# features/listening-queries

Listening Queries screen (UX §3.5, FR-050..062). See docs/02-architecture/03-frontend-design.md §1.

- `api.ts` — `useListeningQueries(pid, { includeDeleted })`: infinite list, `limit=200`, stale cursor resets (#195).
- `format.ts` — pure helpers: `formatQueryValue` (`#` for tags, BR-004), `syncStatus` (dot + label, BR-017), `truncateError`, `formatDuration`, `isStaleError` (#342).
- `queries-table.tsx` — 6-column table inside an operate board (md+), sticky ⋯ column (#340).
- `queries-list-mobile.tsx` — row cards below `md` (#340); `query-cells.tsx` holds the cells both share.
- `sync-cells.tsx` — "Lần đồng bộ cuối" status (links to the job) and "Lỗi gần nhất" (current = red + "Xem lượt lỗi", stale = grey) (#342).
- `query-actions-menu.tsx` — row menu: "Xem bài nhắc" (`/mentions?queryIds=<id>`, FR-062) for all roles; admin items render only when a handler is passed.
- `listening-queries-view.tsx` — page body: fascia + "Thêm truy vấn" (admin), "Hiện truy vấn đã xoá" toggle (`?deleted=1`), loading/error/empty states, "Tải thêm".

- `api.ts` (also) — mutations `useCreate/Update/Delete/Restore/RunListeningQuery` (invalidate every list variant), `useListeningQuery(pid, id)` for `?edit=<id>`, `queryErrorMessage`, `duplicateExistingId`, `runningJobId`.
- `query-form.ts` — pure form logic: values ↔ contract bodies, FR-052 validation via contract schemas, PATCH diff without immutable fields (FR-054), presets.
- `term-input.tsx` — tag input for include/exclude terms (Enter/comma, case-insensitive dedupe).
- `query-form-fields.tsx` / `query-form-drawer.tsx` — create/edit drawer (#43); duplicate → toast "Xem truy vấn".
- `delete-query-dialog.tsx` — soft-delete confirm (FR-057).
- `api.ts` (backfill, #112) — `useBackfillListeningQuery` (FR-063), `useBackfillJobProgress` (polls `GET …/sync-jobs/:id` every 3 s while queued/running, off when hidden), `useInvalidateQueryList`.
- `backfill-form.ts` — pure: calendar range ↔ UTC body in the project tz (until clamped to now), 30-day hint validation, status labels (BR-017), counters.
- `backfill-dialog.tsx` / `backfill-progress.tsx` — "Lấy dữ liệu cũ" dialog: form step → progress step; 409 SYNC_ALREADY_RUNNING follows the active job (BR-010).
- `use-query-actions.ts` — run / toggle / delete / restore with toasts; "Xem lượt đồng bộ" → `jobHref` (`format.ts`).
