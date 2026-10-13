Feature folder — see docs/02-architecture/03-frontend-design.md §1 and the T-### tasks for this epic in docs/03-delivery/02-work-breakdown.md.

Files:

- `filter-bar.tsx`, `time-controls.tsx`, `applied-filter-chips.tsx`, `enum-multi-select.tsx` — shared filter bar (T-098).
- `api.ts` — `useOverview(pid, apiParams)` hook for `GET /projects/:projectId/analytics/overview`.
- `kpi-definitions.ts` — KPI labels + tooltip copy from docs/01-product/07-metric-definitions.md §1.
- `kpi-cards.tsx` — six KPI cards (FR-132/133/140): "—" for null rates, "New" for growth, pp delta when compare is on.
- `overview-banners.tsx` — banners from `coverage` / `dataQuality` (FR-134).
- `overview-view.tsx` — `/overview` body.
