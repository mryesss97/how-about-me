import type { AnalyticsQuery, OverviewResponse } from "@how-about-me/contracts";
import { Injectable } from "@nestjs/common";
import { AppError } from "../../common/errors/app.error";
import { previousPeriodInTz, toRangeDto } from "../../common/time/range";
import { resolveAnalyticsQuery } from "./analytics-filters";
import { METRICS_VERSION } from "./metrics-version";
import { collectorStatus, growth, rate, type RateValue } from "./overview.math";
import { type KpiCounts, OverviewRepository } from "./overview.repository";

/** Overview KPIs, coverage and data quality — FR-132, FR-133, FR-134, FR-140, FR-141; doc 07 §1, §2. */
@Injectable()
export class OverviewService {
  constructor(private readonly repo: OverviewRepository) {}

  async get(projectId: string, query: AnalyticsQuery, now: Date = new Date()): Promise<OverviewResponse> {
    const project = await this.repo.findProject(projectId);
    if (!project) throw new AppError("NOT_FOUND", "Project not found");
    const { scope, previousScope } = resolveAnalyticsQuery(query, project, now);
    // Growth is always shown (FR-133), so the previous mention count is computed even when compare=false.
    const growthScope = previousScope ?? { ...scope, range: previousPeriodInTz(scope.range, scope.timezone) };
    const [cur, prev, cov, dq] = await Promise.all([
      this.repo.kpiCounts(scope),
      this.repo.kpiCounts(growthScope),
      this.repo.coverageCounts(scope),
      this.repo.dataQuality(projectId, now),
    ]);
    const compare = previousScope !== undefined;
    const withPrev = (r: RateValue, p: RateValue) => (compare ? { ...r, previous: p.value } : r);
    const rates = (k: KpiCounts) => ({
      positive: rate(k.positive, k.sentimentAnalyzed),
      negative: rate(k.negative, k.sentimentAnalyzed),
      safety: rate(k.safetyRisk, k.safetyAnalyzed),
      complaint: rate(k.complaint, k.intentAnalyzed),
    });
    const c = rates(cur);
    const p = rates(prev);
    return {
      meta: { metricsVersion: METRICS_VERSION, generatedAt: now.toISOString() },
      range: {
        ...toRangeDto(scope.range, scope.timezone),
        timezone: scope.timezone,
        ...(previousScope ? { previous: toRangeDto(previousScope.range, scope.timezone) } : {}),
      },
      coverage: {
        relevantMentions: cur.mentionCount,
        analyzedMentions: cov.analyzed,
        pendingMentions: cov.pending,
        failedMentions: cov.failed,
        irrelevantMentions: cov.irrelevant,
        uncertainMentions: cov.uncertain,
      },
      dataQuality: {
        lastSyncStatus: dq.lastSyncStatus,
        lastSyncAt: dq.lastSyncAt?.toISOString() ?? null,
        integrationStatus: dq.integrationStatus,
        collectorStatus: collectorStatus({ ...dq, now }),
      },
      kpis: {
        mentionCount: {
          value: cur.mentionCount,
          previous: prev.mentionCount,
          ...growth(cur.mentionCount, prev.mentionCount),
        },
        positiveRate: withPrev(c.positive, p.positive),
        negativeRate: withPrev(c.negative, p.negative),
        safetyRiskRate: { ...withPrev(c.safety, p.safety), severeCount: cur.severe },
        complaintRate: withPrev(c.complaint, p.complaint),
      },
    };
  }
}
