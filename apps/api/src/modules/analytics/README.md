# analytics module

Implemented by the backlog tasks listed in [docs/03-delivery/02-work-breakdown.md](../../../../../docs/03-delivery/02-work-breakdown.md) (search for `analytics`).
Design: see docs/02-architecture/02-backend-design.md §3 and the related pipeline/API docs. Follow conventions in docs/06-engineering/03-coding-conventions.md §2.

## Foundation (T-090)

- `common/time/range.ts` — `resolveRange` (defaults, ≤ 366 d check), `previousPeriodInTz` (FR-141, calendar days for whole local days, ms otherwise), `formatInTz`/`toRangeDto` (ISO with tz offset).
- `analytics-filters.ts` — `resolveAnalyticsQuery(query, project, now)` → `{ scope, previousScope? }`; `buildBaseSetCte(scope, { ignore })` → CTE `base` (one row per post, metric-definitions §0); `withBase(scope, body)`; `bucketExpr(col, interval, tz)` and `timeColumn(field)` for timeseries. All values are bound params; only whitelisted columns/units go through `Prisma.raw`.

## Overview (T-091)

- `GET /projects/:projectId/analytics/overview` — `overview.controller.ts` → `overview.service.ts` → `overview.repository.ts` (raw SQL over `base`). Pure helpers (`rate`, `growth`, `collectorStatus`) in `overview.math.ts`; `METRICS_VERSION` in `metrics-version.ts`.
- KPIs use the filtered base set; coverage ignores relevance/status/label filters; mention growth is always computed vs the previous period, rate `previous` only with `compare=true` (metric-definitions §1–§2).

## Timeseries (T-092)

- `GET projects/:projectId/analytics/mentions-timeseries` — `analytics-timeseries.controller.ts` → `analytics-timeseries.service.ts` (`chooseInterval`, `alignSeries`) → `analytics-timeseries.repository.ts` (raw SQL).
- `bucketSeriesCte(range, interval, tz)` in `analytics-filters.ts` — CTE `buckets` for zero-fill; join counts on `bucketExpr` of the same base time column.
- `AnalyticsTimeseriesService.sentimentTimeseries(scope, interval?)` — exported for `/analytics/sentiment` (T-093).

## Distributions (T-093)

- `GET …/analytics/{sentiment,safety,intents,topics}` — `analytics-distributions.{controller,service,repository}.ts`, pure helpers in `distributions.ts`.
- Denominators: sentiment/safety = sum of label counts; intents/topics = posts with ≥ 1 label (`intentAnalyzed`/`topicAnalyzed`), computed in the same SQL snapshot.
- Topics: top 12 real labels + `other` bucket (DISTINCT posts tagged `other` or outside the top). Intent/topic overrides are not applied yet (T-142).
- Sentiment includes `timeseries` from `AnalyticsTimeseriesService.sentimentTimeseries` (T-092; hour ≤ 48 h, else day, zero-filled).
