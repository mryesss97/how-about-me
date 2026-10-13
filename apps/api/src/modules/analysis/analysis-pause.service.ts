import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { PrismaService } from "../../database/prisma.service";
import { ANALYSIS_AUTH_PAUSE_MS } from "./analysis-failure-policy";

export const PAUSE_STATE_TTL_MS = 30_000;

export type AnalysisPauseState = {
  budget: { limitUsd: number; spentTodayUsd: number; exceeded: boolean; dayStartUtc: Date; resetsAt: Date };
  auth: { lastFailureAt: Date | null; pausedUntil: Date | null };
};

/**
 * Worker pause signals (T-075) — docs/02-architecture/07-analysis-pipeline.md §8/§9.
 * Read from the DB so every worker instance and System Status (T-077) see the same state:
 * - budget: SUM(estimated_cost_usd) of runs completed since 00:00 UTC (guardrail, deliberately not VN time);
 * - auth: 5 min after the latest `failed ANALYSIS_PROVIDER_AUTH` run.
 * Cached for `PAUSE_STATE_TTL_MS` so the worker does not run the SUM every tick.
 */
@Injectable()
export class AnalysisPauseService {
  private cache: { at: number; state: AnalysisPauseState } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async getState(opts: { fresh?: boolean } = {}): Promise<AnalysisPauseState> {
    const now = Date.now();
    if (!opts.fresh && this.cache && now - this.cache.at < PAUSE_STATE_TTL_MS) return this.cache.state;
    const state = await this.load(new Date(now));
    this.cache = { at: now, state };
    return state;
  }

  invalidate(): void {
    this.cache = null;
  }

  private async load(now: Date): Promise<AnalysisPauseState> {
    const [spentRows, authRows] = await Promise.all([
      this.prisma.$queryRaw<{ spent: number }[]>(Prisma.sql`
        SELECT COALESCE(SUM(estimated_cost_usd), 0)::float8 AS spent
        FROM analysis_runs
        WHERE completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND estimated_cost_usd IS NOT NULL`),
      this.prisma.$queryRaw<{ at: Date | null }[]>(Prisma.sql`
        SELECT max(completed_at) AS at FROM analysis_runs
        WHERE status = 'failed' AND error_code = 'ANALYSIS_PROVIDER_AUTH'
          AND completed_at > now() - make_interval(secs => ${ANALYSIS_AUTH_PAUSE_MS / 1000}::int)`),
    ]);
    const limitUsd = this.cfg.ANALYSIS_DAILY_BUDGET_USD;
    const spentTodayUsd = Number(spentRows[0]?.spent ?? 0);
    const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lastFailureAt = authRows[0]?.at ?? null;
    return {
      // Q4: a limit ≤ 0 disables the cap.
      budget: {
        limitUsd,
        spentTodayUsd,
        exceeded: limitUsd > 0 && spentTodayUsd >= limitUsd,
        dayStartUtc,
        resetsAt: new Date(dayStartUtc.getTime() + 86_400_000),
      },
      auth: {
        lastFailureAt,
        pausedUntil: lastFailureAt ? new Date(lastFailureAt.getTime() + ANALYSIS_AUTH_PAUSE_MS) : null,
      },
    };
  }
}
