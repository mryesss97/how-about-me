import { Injectable } from "@nestjs/common";
import type { SentimentResponse, TimeseriesQuery, TimeseriesResponse } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import { bucketInterval, formatInTz, type Range, rangeDays } from "../../common/time/range";
import { type AnalyticsScope, resolveAnalyticsQuery } from "./analytics-filters";
import { AnalyticsTimeseriesRepository, type CountBucket, type Interval } from "./analytics-timeseries.repository";

/** `hour` override is capped at 31 days (≤ 744 points) — api-contract §6 mentions-timeseries. */
export const MAX_HOUR_RANGE_DAYS = 31;

/** TC-DASH-002: explicit interval wins; otherwise ≤ 48 h → hour, else day. */
export function chooseInterval(range: Range, override?: Interval): Interval {
  if (override === "hour" && rangeDays(range) > MAX_HOUR_RANGE_DAYS)
    throw new AppError("VALIDATION_ERROR", `interval=hour requires a range of at most ${MAX_HOUR_RANGE_DAYS} days`);
  return override ?? bucketInterval(range);
}

/**
 * FR-141: previous series aligned by bucket position (bucket i ↔ bucket i). Missing → 0, extra dropped
 * (lengths only differ around DST). `previous` key present only when compare is on.
 */
export function alignSeries(
  current: readonly CountBucket[],
  previous: readonly CountBucket[] | undefined,
  timezone: string,
): TimeseriesResponse["data"] {
  return current.map((c, i) => ({
    time: formatInTz(c.bucket, timezone),
    mentions: c.n,
    ...(previous ? { previous: previous[i]?.n ?? 0 } : {}),
  }));
}

/** T-092 — metric-definitions §3.1/§3.3, FR-135, FR-136, FR-141, FR-147. */
@Injectable()
export class AnalyticsTimeseriesService {
  constructor(private readonly repo: AnalyticsTimeseriesRepository) {}

  async mentionsTimeseries(projectId: string, query: TimeseriesQuery, now = new Date()): Promise<TimeseriesResponse> {
    const project = await this.repo.findProject(projectId);
    if (!project) throw new AppError("NOT_FOUND", "Project not found");
    const { interval: override, ...rest } = query;
    const { scope, previousScope } = resolveAnalyticsQuery(rest, project, now);
    const interval = chooseInterval(scope.range, override);
    // Previous uses the same interval as current, never re-derived from its own range.
    const [current, previous] = await Promise.all([
      this.repo.countSeries(scope, interval),
      previousScope ? this.repo.countSeries(previousScope, interval) : Promise.resolve(undefined),
    ]);
    return { interval, timezone: scope.timezone, data: alignSeries(current, previous, scope.timezone) };
  }

  /** FR-136: shared by `/analytics/sentiment` (T-093) for `SentimentResponse.timeseries`. */
  async sentimentTimeseries(
    scope: AnalyticsScope,
    interval: Interval = bucketInterval(scope.range),
  ): Promise<NonNullable<SentimentResponse["timeseries"]>> {
    const rows = await this.repo.sentimentSeries(scope, interval);
    return {
      interval,
      data: rows.map((r) => ({
        time: formatInTz(r.bucket, scope.timezone),
        positive: r.positive,
        neutral: r.neutral,
        negative: r.negative,
      })),
    };
  }
}
