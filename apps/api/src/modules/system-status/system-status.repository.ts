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
