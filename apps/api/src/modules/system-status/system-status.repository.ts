import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export type ThreadsConnectionRow = {
  status: string;
  accountIdentifier: string | null;
  tokenExpiresAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: Date | null;
};

export type EnabledQueriesStats = { count: number; lastSyncAt: Date | null; maxPollIntervalSeconds: number | null };
export type JobStatusCounts = { success: number; partial: number; failed: number };
export type AnalysisStats = {
  pending: number;
  processing: number;
  failed24h: number;
  completed24h: number;
  oldestOpenCreatedAt: Date | null;
  inputTokens24h: number;
  outputTokens24h: number;
  estimatedCost24hUsd: number;
};
export type DatabaseStats = { approxPosts: number; approxAnalyses: number; lastMigration: string | null };

/** Read-only aggregates for system status (T-057). Prisma types never leave this file; secrets are never selected. */
@Injectable()
export class SystemStatusRepository {
  constructor(private readonly prisma: PrismaService) {}

  findThreadsConnection(projectId: string): Promise<ThreadsConnectionRow | null> {
    return this.prisma.integrationConnection.findUnique({
      where: { projectId_platform: { projectId, platform: "threads" } },
      select: {
        status: true,
        accountIdentifier: true,
        tokenExpiresAt: true,
        lastSuccessAt: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        lastErrorAt: true,
      },
    });
  }

  async enabledQueriesStats(projectId: string): Promise<EnabledQueriesStats> {
    const r = await this.prisma.listeningQuery.aggregate({
      where: { projectId, enabled: true },
      _count: { _all: true },
      _max: { lastSuccessfulSyncAt: true, pollIntervalSeconds: true },
    });
    return {
      count: r._count._all,
      lastSyncAt: r._max.lastSuccessfulSyncAt,
      maxPollIntervalSeconds: r._max.pollIntervalSeconds,
    };
  }

  async jobCountsSince(projectId: string, since: Date): Promise<JobStatusCounts> {
    const rows = await this.prisma.syncJob.groupBy({
      by: ["status"],
      where: { projectId, createdAt: { gte: since }, status: { in: ["success", "partial", "failed"] } },
      _count: { _all: true },
    });
    const out: JobStatusCounts = { success: 0, partial: 0, failed: 0 };
    for (const r of rows) {
      if (r.status === "success" || r.status === "partial" || r.status === "failed") out[r.status] = r._count._all;
    }
    return out;
  }

  /** Only `running` jobs count as in progress (queued excluded). */
  jobsInProgress(projectId: string): Promise<number> {
    return this.prisma.syncJob.count({ where: { projectId, status: "running" } });
  }

  /**
   * T-077: open counts now + rolling 24h (UTC, BR-028) by `completed_at` (set on completed and failed runs),
   * scoped to the project. One aggregate query.
   */
  async analysisStats(projectId: string, since: Date): Promise<AnalysisStats> {
    const rows = await this.prisma.$queryRaw<
      {
        pending: number;
        processing: number;
        failed24h: number;
        completed24h: number;
        oldest_open: Date | null;
        input_tokens: number;
        output_tokens: number;
        cost: number;
      }[]
    >(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE status = 'pending')::int AS pending,
        count(*) FILTER (WHERE status = 'processing')::int AS processing,
        count(*) FILTER (WHERE status = 'failed' AND completed_at >= ${since})::int AS "failed24h",
        count(*) FILTER (WHERE status = 'completed' AND completed_at >= ${since})::int AS "completed24h",
        min(created_at) FILTER (WHERE status IN ('pending', 'processing')) AS oldest_open,
        COALESCE(SUM(input_tokens) FILTER (WHERE completed_at >= ${since}), 0)::float8 AS input_tokens,
        COALESCE(SUM(output_tokens) FILTER (WHERE completed_at >= ${since}), 0)::float8 AS output_tokens,
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE completed_at >= ${since}), 0)::float8 AS cost
      FROM analysis_runs
      WHERE project_id = ${projectId}::uuid
        AND (status IN ('pending', 'processing') OR completed_at >= ${since})`);
    const r = rows[0];
    return {
      pending: r?.pending ?? 0,
      processing: r?.processing ?? 0,
      failed24h: r?.failed24h ?? 0,
      completed24h: r?.completed24h ?? 0,
      oldestOpenCreatedAt: r?.oldest_open ?? null,
      inputTokens24h: Number(r?.input_tokens ?? 0),
      outputTokens24h: Number(r?.output_tokens ?? 0),
      estimatedCost24hUsd: Number(r?.cost ?? 0),
    };
  }

  async databaseStats(): Promise<DatabaseStats> {
    const rel = await this.prisma.$queryRaw<{ relname: string; reltuples: number }[]>(
      Prisma.sql`SELECT relname, reltuples::float8 AS reltuples FROM pg_class
                 WHERE relkind = 'r' AND relname IN ('social_posts', 'post_analyses')
                   AND relnamespace = current_schema()::regnamespace`,
    );
    // reltuples = -1 before the first ANALYZE → clamp to 0.
    const approx = (name: string) =>
      Math.max(0, Math.round(Number(rel.find((r) => r.relname === name)?.reltuples ?? 0)));
    let lastMigration: string | null = null;
    try {
      const m = await this.prisma.$queryRaw<{ migration_name: string }[]>(
        Prisma.sql`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
                   ORDER BY finished_at DESC LIMIT 1`,
      );
      lastMigration = m[0]?.migration_name ?? null;
    } catch {
      lastMigration = null;
    }
    return { approxPosts: approx("social_posts"), approxAnalyses: approx("post_analyses"), lastMigration };
  }
}
