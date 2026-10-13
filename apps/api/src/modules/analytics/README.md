# analytics module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `analytics`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Foundation (T-090)

- `common/time/range.ts` — `resolveRange` (defaults, ≤ 366 d check), `previousPeriodInTz` (FR-141, calendar days for whole local days, ms otherwise), `formatInTz`/`toRangeDto` (ISO with tz offset).
- `analytics-filters.ts` — `resolveAnalyticsQuery(query, project, now)` → `{ scope, previousScope? }`; `buildBaseSetCte(scope, { ignore })` → CTE `base` (one row per post, metric-definitions §0); `withBase(scope, body)`; `bucketExpr(col, interval, tz)` and `timeColumn(field)` for timeseries. All values are bound params; only whitelisted columns/units go through `Prisma.raw`.

## Timeseries (T-092)

- `GET projects/:projectId/analytics/mentions-timeseries` — `analytics-timeseries.controller.ts` → `analytics-timeseries.service.ts` (`chooseInterval`, `alignSeries`) → `analytics-timeseries.repository.ts` (raw SQL).
- `bucketSeriesCte(range, interval, tz)` in `analytics-filters.ts` — CTE `buckets` for zero-fill; join counts on `bucketExpr` of the same base time column.
- `AnalyticsTimeseriesService.sentimentTimeseries(scope, interval?)` — exported for `/analytics/sentiment` (T-093).
