import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { type AnalyticsScope, withBase } from "./analytics-filters";
import type { LandingTermCell } from "./landing-terms";

/**
 * FR-149 landing terms × sentiment over the base set `B` (BR-016 default relevance, BR-025 effective sentiment).
 * BR-042: a post mentions a term when its lowercased text (whitespace and `, ; |` collapsed to one space) contains the
 * term, or a key phrase of its current analysis contains it. `strpos` avoids LIKE wildcards. DISTINCT (term, post) — FR-147.
 */
@Injectable()
export class AnalyticsLandingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProjectWithSettings(projectId: string): Promise<{ id: string; timezone: string; settings: unknown } | null> {
    return this.prisma.monitoringProject.findUnique({
      where: { id: projectId },
      select: { id: true, timezone: true, settings: true },
    });
  }

  async landingTermCounts(
    scope: AnalyticsScope,
    terms: readonly string[],
  ): Promise<{ cells: LandingTermCell[]; sentimentAnalyzed: number }> {
    type Row = { kind: string; ord: number | null; sentiment: string | null; count: number };
    const rows = await this.prisma.$queryRaw<Row[]>(
      withBase(
        scope,
        Prisma.sql`, terms AS (
              SELECT t.term, t.ord::int AS ord FROM unnest(${[...terms]}::text[]) WITH ORDINALITY AS t(term, ord)),
            texts AS (
              SELECT b.post_id, b.analysis_id, b.sentiment_label::text AS sentiment,
                     regexp_replace(lower(normalize(coalesce(p.text, ''), NFC)), '[\\s,;|]+', ' ', 'g') AS norm
                FROM base b JOIN social_posts p ON p.id = b.post_id
               WHERE b.sentiment_label IS NOT NULL),
            matched AS (
              SELECT DISTINCT t.ord, x.post_id, x.sentiment
                FROM texts x CROSS JOIN terms t
               WHERE strpos(x.norm, t.term) > 0
                  OR EXISTS (SELECT 1 FROM analysis_phrases ap
                              WHERE ap.analysis_id = x.analysis_id AND strpos(ap.phrase, t.term) > 0))
          SELECT 'cell' AS kind, ord, sentiment, COUNT(*)::int AS count FROM matched GROUP BY ord, sentiment
          UNION ALL SELECT 'sentimentAnalyzed', NULL, NULL,
                           (SELECT COUNT(DISTINCT post_id)::int FROM base WHERE sentiment_label IS NOT NULL)`,
      ),
    );
    return {
      cells: rows.flatMap((r) =>
        r.kind === "cell" && r.ord !== null && r.sentiment !== null
          ? [{ ord: r.ord, sentiment: r.sentiment, count: r.count }]
          : [],
      ),
      sentimentAnalyzed: rows.find((r) => r.kind === "sentimentAnalyzed")?.count ?? 0,
    };
  }
}
