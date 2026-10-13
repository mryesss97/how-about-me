import type { IntegrationStatus, JobStatus } from "@how-about-me/contracts";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { type AnalyticsScope, type IgnorableFilter, withBase } from "./analytics-filters";
import { lastSyncWindowMs } from "./overview.math";

export type KpiCounts = {
  mentionCount: number;
  sentimentAnalyzed: number;
  positive: number;
  negative: number;
  safetyAnalyzed: number;
  safetyRisk: number;
  severe: number;
  intentAnalyzed: number;
  complaint: number;
};
export type CoverageCounts = {
  analyzed: number;
  pending: number;
  failed: number;
  irrelevant: number;
  uncertain: number;
};
export type DataQualityRaw = {
  lastSyncStatus: JobStatus | "none";
  lastSyncAt: Date | null;
  integrationStatus: IntegrationStatus;
  circuitOpenUntil: Date | null;
};

/**
 * Coverage ignores relevance, status and label filters — pending/failed posts have no labels (doc 07 §1.7, §2).
 * Dropping the relevance filter here is deliberate: BR-016 (default relevance = relevant) applies to KPIs only.
 */
const COVERAGE_IGNORE: readonly IgnorableFilter[] = [
  "relevance",
  "analysisStatus",
  "sentiment",
  "safety",
  "intent",
  "topic",
  "language",
];

/** Raw-SQL reads for the overview endpoint (T-091). Prisma types stay here. */
@Injectable()
export class OverviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProject(projectId: string): Promise<{ id: string; timezone: string } | null> {
    return this.prisma.monitoringProject.findUnique({ where: { id: projectId }, select: { id: true, timezone: true } });
  }

  /**
   * FR-132, FR-147: base is one row per post, so COUNT(DISTINCT post_id) is exact. Labels come from the
   * `effective_post_analysis` view (BR-025: override > latest completed run); BR-016 default relevance applies.
   */
  async kpiCounts(scope: AnalyticsScope): Promise<KpiCounts> {
    const rows = await this.prisma.$queryRaw<KpiCounts[]>(
      withBase(
        scope,
        Prisma.sql`SELECT
          COUNT(DISTINCT post_id)::int AS "mentionCount",
          COUNT(DISTINCT post_id) FILTER (WHERE sentiment_label IS NOT NULL)::int AS "sentimentAnalyzed",
          COUNT(DISTINCT post_id) FILTER (WHERE sentiment_label = 'positive')::int AS "positive",
          COUNT(DISTINCT post_id) FILTER (WHERE sentiment_label = 'negative')::int AS "negative",
          COUNT(DISTINCT post_id) FILTER (WHERE safety_level IS NOT NULL)::int AS "safetyAnalyzed",
          COUNT(DISTINCT post_id) FILTER (WHERE safety_level IN ('sensitive','severe'))::int AS "safetyRisk",
          COUNT(DISTINCT post_id) FILTER (WHERE safety_level = 'severe')::int AS "severe",
          COUNT(DISTINCT post_id) FILTER (WHERE EXISTS (
            SELECT 1 FROM effective_post_intents i WHERE i.post_id = base.post_id))::int AS "intentAnalyzed",
          COUNT(DISTINCT post_id) FILTER (WHERE EXISTS (
            SELECT 1 FROM effective_post_intents i WHERE i.post_id = base.post_id AND i.label = 'complaint'))::int AS "complaint"
        FROM base`,
      ),
    );
    const [row] = rows;
    if (!row) throw new Error("kpiCounts returned no row");
    return row;
  }

  /** metric-definitions §2 coverage — analyzed counts any relevance. */
  async coverageCounts(scope: AnalyticsScope): Promise<CoverageCounts> {
    const rows = await this.prisma.$queryRaw<CoverageCounts[]>(
      withBase(
        scope,
        Prisma.sql`SELECT
          COUNT(DISTINCT post_id) FILTER (WHERE analysis_id IS NOT NULL)::int AS "analyzed",
          COUNT(DISTINCT post_id) FILTER (WHERE analysis_id IS NULL AND latest_run_status IN ('pending','processing'))::int AS "pending",
          COUNT(DISTINCT post_id) FILTER (WHERE analysis_id IS NULL AND latest_run_status = 'failed')::int AS "failed",
          COUNT(DISTINCT post_id) FILTER (WHERE relevance_label = 'irrelevant')::int AS "irrelevant",
          COUNT(DISTINCT post_id) FILTER (WHERE relevance_label = 'uncertain')::int AS "uncertain"
        FROM base`,
        { ignore: COVERAGE_IGNORE },
      ),
    );
    const [row] = rows;
    if (!row) throw new Error("coverageCounts returned no row");
    return row;
  }

  async dataQuality(projectId: string, now: Date): Promise<DataQualityRaw> {
    const [poll, integration, collector] = await Promise.all([
      this.prisma.listeningQuery.aggregate({
        where: { projectId, enabled: true, deletedAt: null },
        _max: { pollIntervalSeconds: true },
      }),
      this.prisma.integrationConnection.findFirst({
        where: { projectId, platform: "threads" },
        select: { status: true },
      }),
      this.prisma.collectorState.findUnique({ where: { projectId }, select: { circuitOpenUntil: true } }),
    ]);
    const since = new Date(now.getTime() - lastSyncWindowMs(poll._max.pollIntervalSeconds));
    const job = await this.prisma.syncJob.findFirst({
      where: { projectId, status: { in: ["success", "partial", "failed"] }, completedAt: { gte: since } },
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true },
    });
    return {
      lastSyncStatus: job?.status ?? "none",
      lastSyncAt: job?.completedAt ?? null,
      integrationStatus: integration?.status ?? "disconnected",
      circuitOpenUntil: collector?.circuitOpenUntil ?? null,
    };
  }
}
