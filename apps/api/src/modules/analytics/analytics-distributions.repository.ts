import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { LANGUAGE_CODES, TOPIC_LABELS } from "@how-about-me/taxonomy";
import { PrismaService } from "../../database/prisma.service";
import { type AnalyticsScope, withBase } from "./analytics-filters";
import { type LabelCount, TOP_TOPICS, type TopicSentimentCount } from "./distributions";

export type TaggedCounts = { rows: LabelCount[]; denominator: number };
export type TopicCounts = { top: LabelCount[]; otherCount: number; denominator: number };

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

  /**
   * §4 Language distribution (FR-143) — DISTINCT posts per language over posts with a language
   * (`language_code IS NOT NULL`, `unknown` included). Codes outside the taxonomy fold into `other`.
   */
  languageCounts(scope: AnalyticsScope): Promise<LabelCount[]> {
    const codes = [...LANGUAGE_CODES];
    return this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`SELECT CASE WHEN language_code = ANY(${codes}::text[]) THEN language_code ELSE 'other' END AS label,
                          COUNT(DISTINCT post_id)::int AS count
                     FROM base WHERE language_code IS NOT NULL GROUP BY 1`,
      ),
    );
  }

  /** §3.6 — counts per intent + intentAnalyzed (posts with ≥ 1 intent) in one snapshot. Effective labels (override > AI, BR-025). */
  async intentCounts(scope: AnalyticsScope): Promise<TaggedCounts> {
    const rows = await this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`, tagged AS (
            SELECT DISTINCT b.post_id, i.label::text AS label
              FROM base b JOIN effective_post_intents i ON i.post_id = b.post_id)
          SELECT label, COUNT(*)::int AS count FROM tagged GROUP BY 1
          UNION ALL SELECT ${DENOM}, COUNT(DISTINCT post_id)::int FROM tagged`,
      ),
    );
    return splitDenominator(rows);
  }

  /**
   * §3.5 — top real topics (taxonomy `other` excluded, ties by taxonomy order), `other` bucket = DISTINCT posts
   * tagged `other` or with a non-top label, and topicAnalyzed — one snapshot. Effective labels (override > AI, BR-025).
   */
  async topicCounts(scope: AnalyticsScope): Promise<TopicCounts> {
    const order = [...TOPIC_LABELS];
    const rows = await this.prisma.$queryRaw<LabelCount[]>(
      withBase(
        scope,
        Prisma.sql`, tagged AS (
            SELECT DISTINCT b.post_id, t.label::text AS label
              FROM base b JOIN effective_post_topics t ON t.post_id = b.post_id),
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

  /**
   * §4 Topic × sentiment (FR-144) — DISTINCT posts per (effective topic, effective sentiment), BR-025.
   * Posts without sentiment drop out (row denominator = posts with topic and sentiment); labels outside the
   * taxonomy are ignored.
   */
  topicSentimentCounts(scope: AnalyticsScope): Promise<TopicSentimentCount[]> {
    const labels = [...TOPIC_LABELS];
    return this.prisma.$queryRaw<TopicSentimentCount[]>(
      withBase(
        scope,
        Prisma.sql`SELECT t.label::text AS topic, b.sentiment_label::text AS sentiment,
                          COUNT(DISTINCT b.post_id)::int AS count
                     FROM base b JOIN effective_post_topics t ON t.post_id = b.post_id
                    WHERE b.sentiment_label IS NOT NULL AND t.label::text = ANY(${labels}::text[])
                    GROUP BY 1, 2`,
      ),
    );
  }
}

function splitDenominator(rows: LabelCount[]): TaggedCounts {
  const denominator = rows.find((r) => r.label === DENOM)?.count ?? 0;
  return { rows: rows.filter((r) => r.label !== DENOM), denominator };
}
