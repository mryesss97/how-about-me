import { Injectable } from "@nestjs/common";
import type {
  AnalyticsQuery,
  IntentsDistributionResponse,
  SafetyDistributionResponse,
  SentimentResponse,
  TopicsDistributionResponse,
} from "@how-about-me/contracts";
import { INTENT_LABELS, SAFETY_LEVELS, SENTIMENT_LABELS, TOPIC_LABELS } from "@how-about-me/taxonomy";
import { AppError } from "../../common/errors/app.error";
import { type AnalyticsScope, resolveAnalyticsQuery } from "./analytics-filters";
import { AnalyticsDistributionsRepository } from "./analytics-distributions.repository";
import { AnalyticsTimeseriesService } from "./analytics-timeseries.service";
import { sortByCountDesc, toDistribution, toTopicsDistribution } from "./distributions";

/** T-093 — FR-136…FR-140, FR-147; docs/02-architecture/05-api-contract.md §6. */
@Injectable()
export class AnalyticsDistributionsService {
  constructor(
    private readonly repo: AnalyticsDistributionsRepository,
    private readonly timeseries: AnalyticsTimeseriesService,
  ) {}

  async sentiment(projectId: string, query: AnalyticsQuery): Promise<SentimentResponse> {
    const scope = await this.scope(projectId, query);
    // FR-136 sentiment over time reuses the T-092 helper (default interval: hour ≤ 48 h, else day).
    const [rows, timeseries] = await Promise.all([
      this.repo.sentimentCounts(scope),
      this.timeseries.sentimentTimeseries(scope),
    ]);
    const denominator = rows.reduce((s, r) => s + r.count, 0);
    return { denominator, distribution: toDistribution(SENTIMENT_LABELS, rows, denominator), timeseries };
  }

  async safety(projectId: string, query: AnalyticsQuery): Promise<SafetyDistributionResponse> {
    const rows = await this.repo.safetyCounts(await this.scope(projectId, query));
    const denominator = rows.reduce((s, r) => s + r.count, 0);
    return { denominator, distribution: toDistribution(SAFETY_LEVELS, rows, denominator) };
  }

  async intents(projectId: string, query: AnalyticsQuery): Promise<IntentsDistributionResponse> {
    const { rows, denominator } = await this.repo.intentCounts(await this.scope(projectId, query));
    return { denominator, distribution: sortByCountDesc(toDistribution(INTENT_LABELS, rows, denominator)) };
  }

  async topics(projectId: string, query: AnalyticsQuery): Promise<TopicsDistributionResponse> {
    const { top, otherCount, denominator } = await this.repo.topicCounts(await this.scope(projectId, query));
    return { denominator, distribution: toTopicsDistribution(TOPIC_LABELS, top, otherCount, denominator) };
  }

  private async scope(projectId: string, query: AnalyticsQuery): Promise<AnalyticsScope> {
    const project = await this.repo.findProjectTimezone(projectId);
    if (!project) throw new AppError("NOT_FOUND", "Project not found");
    return resolveAnalyticsQuery(query, project).scope;
  }
}
