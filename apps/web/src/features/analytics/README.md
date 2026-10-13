Feature folder — see docs/02-architecture/03-frontend-design.md §1 and the T-### tasks for this epic in docs/03-delivery/02-work-breakdown.md.

Files:

- `filter-bar.tsx`, `time-controls.tsx`, `applied-filter-chips.tsx`, `enum-multi-select.tsx` — shared filter bar (T-098).
- `api.ts` — `useOverview`, `useMentionsTimeseries`, `useSentiment`, `useSafetyDistribution`, `useTopicsDistribution`, `useIntentsDistribution`, `useLanguagesDistribution` hooks (`GET …/analytics/overview|mentions-timeseries|sentiment|safety|topics|intents|languages`), all keyed on `apiParams`.
- `kpi-definitions.ts` — KPI labels + tooltip copy from docs/01-product/07-metric-definitions.md §1.
- `kpi-cards.tsx` — six KPI cards (FR-132/133/140): "—" for null rates, "New" for growth, pp delta when compare is on.
- `overview-banners.tsx` — banners from `coverage` / `dataQuality` (FR-134).
- `overview-view.tsx` — `/overview` body.
- `charts/` — overview charts (T-100):
  - `index.ts` — lazy (`next/dynamic`, `ssr: false`) entry points used by `overview-view.tsx`.
  - `chart-card.tsx` — shared card: title, "View as table" toggle (NFR-032), loading/error/empty states. Reused by T-101.
  - `metric-tooltip.tsx` — tooltip body: count, share, "of {denominator}", optional "Previous".
  - `chart-data.ts` — pure helpers (bucket labels in tz, bucket range, stack totals, colours).
  - `mentions-over-time-chart.tsx`, `sentiment-distribution-chart.tsx`, `sentiment-over-time-chart.tsx`.
  - T-101: `horizontal-bar-chart.tsx` (shared, internal), `safety-distribution-chart.tsx` (patterns + icons), `top-topics-chart.tsx`, `intent-distribution-chart.tsx`.
  - T-148: `language-distribution-chart.tsx` — language donut + 8-row table (P1 row, FR-143).
