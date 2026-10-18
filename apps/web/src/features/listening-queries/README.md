# features/listening-queries

Listening Queries screen (UX §3.5, FR-050..062). See docs/02-architecture/03-frontend-design.md §1.

- `api.ts` — `useListeningQueries(pid, { includeDeleted })`: infinite list, `limit=200`, stale cursor resets (#195).
- `format.ts` — pure helpers: `formatQueryValue` (`#` for tags, BR-004), `syncStatus` (dot + label, BR-017), `truncateError`, `formatDuration`.
- `queries-table.tsx` — the table inside an operate board; horizontal scroll inside the board.
- `query-actions-menu.tsx` — row menu: "Xem bài nhắc" (`/mentions?queryIds=<id>`, FR-062) for all roles; admin items render only when a handler is passed.
- `listening-queries-view.tsx` — page body: fascia + "Thêm truy vấn" (admin), "Hiện truy vấn đã xoá" toggle (`?deleted=1`), loading/error/empty states, "Tải thêm".

Drawer Create/Edit and mutations (run, enable/disable, delete/restore) are #43 [T-047]; they plug in via the view's handler props.
