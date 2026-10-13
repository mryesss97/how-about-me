import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { type AnalyticsScope, bucketExpr, bucketSeriesCte, withBase } from "./analytics-filters";

export type Interval = "hour" | "day";
export type CountBucket = { bucket: Date; n: number };
export type SentimentBucket = { bucket: Date; positive: number; neutral: number; negative: number };

/** Whitelisted `base` column for the scope's timeField (never user input). */
const BASE_TIME_COLUMNS = { published_at: "published_at", first_seen_at: "first_seen_at" } as const;
function baseBucket(scope: AnalyticsScope, interval: Interval): Prisma.Sql {
  return bucketExpr(Prisma.raw(BASE_TIME_COLUMNS[scope.filters.timeField]), interval, scope.timezone);
}

/** Raw timeseries SQL over base set `B` (T-092) — metric-definitions §3.1, §3.3. */
@Injectable()
export class AnalyticsTimeseriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findProject(id: string): Promise<{ id: string; timezone: string } | null> {
    return this.prisma.monitoringProject.findUnique({ where: { id }, select: { id: true, timezone: true } });
  }

  /** COUNT(DISTINCT post_id) per bucket (FR-147), zero-filled (FR-135), bucketed on the filter's timeField. */
  countSeries(scope: AnalyticsScope, interval: Interval): Promise<CountBucket[]> {
    const b = baseBucket(scope, interval);
    return this.prisma.$queryRaw<CountBucket[]>(
      withBase(
        scope,
        Prisma.sql`, ${bucketSeriesCte(scope.range, interval, scope.timezone)},
        counts AS (SELECT ${b} AS bucket, COUNT(DISTINCT post_id)::int AS n FROM base GROUP BY 1)
        SELECT bk.bucket, COALESCE(c.n, 0)::int AS n
          FROM buckets bk LEFT JOIN counts c ON c.bucket = bk.bucket
         ORDER BY bk.bucket`,
      ),
    );
  }

  /** FR-136: per-bucket sentiment label counts (distinct posts), zero-filled. */
  sentimentSeries(scope: AnalyticsScope, interval: Interval): Promise<SentimentBucket[]> {
    const b = baseBucket(scope, interval);
    return this.prisma.$queryRaw<SentimentBucket[]>(
      withBase(
        scope,
        Prisma.sql`, ${bucketSeriesCte(scope.range, interval, scope.timezone)},
        counts AS (
          SELECT ${b} AS bucket,
                 COUNT(DISTINCT post_id) FILTER (WHERE sentiment_label = 'positive')::int AS positive,
                 COUNT(DISTINCT post_id) FILTER (WHERE sentiment_label = 'neutral')::int AS neutral,
                 COUNT(DISTINCT post_id) FILTER (WHERE sentiment_label = 'negative')::int AS negative
            FROM base GROUP BY 1)
        SELECT bk.bucket, COALESCE(c.positive, 0)::int AS positive,
               COALESCE(c.neutral, 0)::int AS neutral, COALESCE(c.negative, 0)::int AS negative
          FROM buckets bk LEFT JOIN counts c ON c.bucket = bk.bucket
         ORDER BY bk.bucket`,
      ),
    );
  }
}
