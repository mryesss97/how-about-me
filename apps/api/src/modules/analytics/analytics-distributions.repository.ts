import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TOPIC_LABELS } from "@how-about-me/taxonomy";
import { PrismaService } from "../../database/prisma.service";
import { type AnalyticsScope, bucketExpr, timeColumn, withBase } from "./analytics-filters";
import { type LabelCount, TOP_TOPICS } from "./distributions";

export type SentimentBucketRow = { bucket: Date; positive: number; neutral: number; negative: number };
export type TaggedCounts = { rows: LabelCount[]; denominator: number };
export type TopicCounts = { top: LabelCount[]; otherCount: number; denominator: number };

const UNITS = { hour: "1 hour", day: "1 day" } as const;
const DENOM = "__denominator__";
const OTHER = "__other__";

/** Distribution SQL over the base set `B` (T-090). Every count is COUNT(DISTINCT post_id) — FR-147. */
@Injectable()
export class AnalyticsDistributionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProjectTimezone(projectId: string): Promise<{ id: string; timezone: string } | null> {
    return this.prisma.monitoringProject.findUnique({ where: { id: projectId }, select: { id: true, timezone: true } });
  }

  /** §3.2 — denominator is the sum (= sentimentAnalyzed); NULL labels (pending/failed) drop out. */
  sentimentCounts(scope: AnalyticsScope): Promise<LabelCount[]> {
    return this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`SELECT sentiment_label::text AS label, COUNT(DISTINCT post_id)::int AS count
                     FROM base WHERE sentiment_label IS NOT NULL GROUP BY 1`,
      ),
    );
  }

  /** §3.4 — denominator is the sum (= safetyAnalyzed). */
  safetyCounts(scope: AnalyticsScope): Promise<LabelCount[]> {
    return this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`SELECT safety_level::text AS label, COUNT(DISTINCT post_id)::int AS count
                     FROM base WHERE safety_level IS NOT NULL GROUP BY 1`,
      ),
    );
  }

  /** §3.6 — counts per intent + intentAnalyzed (posts with ≥ 1 intent) in one snapshot. AI labels only until T-142. */
  async intentCounts(scope: AnalyticsScope): Promise<TaggedCounts> {
    const rows = await this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`, tagged AS (
            SELECT DISTINCT b.post_id, i.label::text AS label
              FROM base b JOIN analysis_intents i ON i.analysis_id = b.analysis_id)
          SELECT label, COUNT(*)::int AS count FROM tagged GROUP BY 1
          UNION ALL SELECT ${DENOM}, COUNT(DISTINCT post_id)::int FROM tagged`,
      ),
    );
    return splitDenominator(rows);
  }

  /**
   * §3.5 — top real topics (taxonomy `other` excluded, ties by taxonomy order), `other` bucket = DISTINCT posts
   * tagged `other` or with a non-top label, and topicAnalyzed — one snapshot. AI labels only until T-142.
   */
  async topicCounts(scope: AnalyticsScope): Promise<TopicCounts> {
    const order = [...TOPIC_LABELS];
    const rows = await this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`, tagged AS (
            SELECT DISTINCT b.post_id, t.label::text AS label
              FROM base b JOIN analysis_topics t ON t.analysis_id = b.analysis_id),
          counts AS (SELECT label, COUNT(*)::int AS n FROM tagged GROUP BY 1),
          top AS (
            SELECT label, n FROM counts WHERE label <> 'other'
             ORDER BY n DESC, array_position(${order}::text[], label) NULLS LAST, label
             LIMIT ${TOP_TOPICS})
          SELECT label, n AS count FROM top
          UNION ALL SELECT ${OTHER}, COUNT(DISTINCT post_id)::int FROM tagged
                     WHERE label NOT IN (SELECT label FROM top)
          UNION ALL SELECT ${DENOM}, COUNT(DISTINCT post_id)::int FROM tagged`,
      ),
    );
    const { rows: rest, denominator } = splitDenominator(rows);
    const otherCount = rest.find((r) => r.label === OTHER)?.count ?? 0;
    return { top: rest.filter((r) => r.label !== OTHER), otherCount, denominator };
  }

  /** §3.3 — zero-filled local-time buckets in [from,to); timezone is a bound param, GROUP BY 1. */
  sentimentTimeseries(scope: AnalyticsScope, interval: "hour" | "day"): Promise<SentimentBucketRow[]> {
    const tz = scope.timezone;
    const unit = Prisma.raw(`'${interval}'`);
    const step = Prisma.raw(`'${UNITS[interval]}'::interval`);
    const bucket = bucketExpr(timeColumn(scope.filters.timeField), interval, tz);
    return this.prisma.$queryRaw<SentimentBucketRow[]>(
      withBase(
        scope,
        Prisma.sql`, series AS (
            SELECT (g AT TIME ZONE ${tz}) AS bucket
              FROM generate_series(date_trunc(${unit}, ${scope.range.from}::timestamptz AT TIME ZONE ${tz}),
                                   ${scope.range.to}::timestamptz AT TIME ZONE ${tz}, ${step}) g),
          agg AS (
            SELECT ${bucket} AS bucket,
                   COUNT(DISTINCT e.post_id) FILTER (WHERE e.sentiment_label = 'positive')::int AS positive,
                   COUNT(DISTINCT e.post_id) FILTER (WHERE e.sentiment_label = 'neutral')::int AS neutral,
                   COUNT(DISTINCT e.post_id) FILTER (WHERE e.sentiment_label = 'negative')::int AS negative
              FROM base e GROUP BY 1)
          SELECT s.bucket, COALESCE(a.positive, 0)::int AS positive, COALESCE(a.neutral, 0)::int AS neutral,
                 COALESCE(a.negative, 0)::int AS negative
            FROM series s LEFT JOIN agg a ON a.bucket = s.bucket
           WHERE s.bucket < ${scope.range.to}::timestamptz
           ORDER BY s.bucket`,
      ),
    );
  }
}

function splitDenominator(rows: LabelCount[]): TaggedCounts {
  const denominator = rows.find((r) => r.label === DENOM)?.count ?? 0;
  return { rows: rows.filter((r) => r.label !== DENOM), denominator };
}
