Feature folder — see docs/02-architecture/03-frontend-design.md §1 and the T-### tasks for this epic in docs/03-delivery/02-work-breakdown.md.

Files:

- `filter-bar.tsx`, `time-controls.tsx`, `applied-filter-chips.tsx`, `enum-multi-select.tsx` — shared filter bar (T-098).
- `api.ts` — `useOverview` (re-exported from `features/shared/use-overview`, #233), `useMentionsTimeseries`, `useSentiment`, `useSafetyDistribution`, `useTopicsDistribution`, `useIntentsDistribution`, `useLanguagesDistribution`, `useQueryShare`, `useTopicSentiment` hooks (`GET …/analytics/overview|mentions-timeseries|sentiment|safety|topics|intents|languages|query-share|topic-sentiment`), all keyed on `apiParams`.
- `kpi-definitions.ts` — KPI labels + tooltip copy from docs/01-product/07-metric-definitions.md §1.
- `kpi-cards.tsx` — six KPI cards (FR-132/133/140): "—" for null rates, "New" for growth, pp delta when compare is on.
- `overview-banners.tsx` — moved to `features/shared/overview-banners.tsx` (also used by Mentions, #233); fixtures in `features/shared/overview-fixture.test-utils.ts`.
- `overview-view.tsx` — `/overview` body.
- `charts/` — overview charts (T-100):
  - `index.ts` — lazy (`next/dynamic`, `ssr: false`) entry points used by `overview-view.tsx`.
  - `chart-card.tsx` — shared card: title, "View as table" toggle (NFR-032), loading/error/empty states. Reused by T-101.
  - `metric-tooltip.tsx` — tooltip body: count, share, "of {denominator}", optional "Previous".
  - `chart-data.ts` — pure helpers (bucket labels in tz, bucket range, stack totals, colours).
  - `mentions-over-time-chart.tsx`, `sentiment-distribution-chart.tsx`, `sentiment-over-time-chart.tsx`.
  - T-101: `horizontal-bar-chart.tsx` (shared, internal), `safety-distribution-chart.tsx` (patterns + icons), `top-topics-chart.tsx`, `intent-distribution-chart.tsx`.
  - T-148: `language-distribution-chart.tsx` — language donut + 8-row table (P1 row, FR-143).
  - T-150: `query-share-chart.tsx` — keyword share bars (FR-145), overlap note, drill-down `queryIds=[id]` via `queryDrillDown`.
  - T-149: `topic-sentiment-heatmap.tsx` (HTML grid, cells are links) and `negative-topics-chart.tsx` (contributors, per-row tooltip denominator via `HorizontalBarChart.rowDenominator`); drill-down via `topicSentimentDrillDown`.
  - #222: `sentiment-bubble-map.tsx` (Sentiment map card), `bubble-canvas.tsx` (3D bubbles + motion), `bubble-detail-panel.tsx`, `sentiment-icon.tsx`, `bubble-layout.ts` (pure: dominant sentiment, intensity, deterministic packing); copy in `../copy.ts`.

## Drill-down (T-102, FR-142)

`OverviewView` builds hrefs with `toMentionsHref` + `lib/filters/drill-down.ts`, pinned to the `from/to` sent to analytics. `KpiCards` takes `hrefFor` (stretched link per card, separate link on "N severe"). Charts take `getHref`/`onNavigate` (`getBucketHref` for mentions over time): bars/slices/buckets navigate on click, and the "View as table" first column renders links (`ChartTable.rowHrefs`) as the keyboard path. Zero-count segments and topic `other` of Top topics are not drillable; in the topic × sentiment matrix `other` is a real label and drills to `topic=other` (T-149).
