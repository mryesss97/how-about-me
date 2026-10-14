import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  type AnalyticsQuery,
  AnalyticsQuerySchema,
  type IntentsDistributionResponse,
  type LanguagesDistributionResponse,
  type PhraseSentimentResponse,
  type PhrasesQuery,
  PhrasesQuerySchema,
  type SafetyDistributionResponse,
  type SentimentResponse,
  type TopicSentimentResponse,
  type TopicsDistributionResponse,
} from "@how-about-me/contracts";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { AnalyticsDistributionsService } from "./analytics-distributions.service";

/** docs/02-architecture/05-api-contract.md §6 — FR-136…FR-140, FR-143, FR-144, FR-148. Read-only, every project role. */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("projects/:projectId/analytics")
export class AnalyticsDistributionsController {
  constructor(private readonly svc: AnalyticsDistributionsService) {}

  @Get("sentiment")
  @Roles("admin", "analyst", "viewer")
  sentiment(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<SentimentResponse> {
    return this.svc.sentiment(projectId, query);
  }

  @Get("safety")
  @Roles("admin", "analyst", "viewer")
  safety(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<SafetyDistributionResponse> {
    return this.svc.safety(projectId, query);
  }

  @Get("intents")
  @Roles("admin", "analyst", "viewer")
  intents(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<IntentsDistributionResponse> {
    return this.svc.intents(projectId, query);
  }

  @Get("topics")
  @Roles("admin", "analyst", "viewer")
  topics(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<TopicsDistributionResponse> {
    return this.svc.topics(projectId, query);
  }

  @Get("languages")
  @Roles("admin", "analyst", "viewer")
  languages(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<LanguagesDistributionResponse> {
    return this.svc.languages(projectId, query);
  }

  @Get("topic-sentiment")
  @Roles("admin", "analyst", "viewer")
  topicSentiment(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<TopicSentimentResponse> {
    return this.svc.topicSentiment(projectId, query);
  }

  /** FR-148 — phrase × sentiment (key phrases of the current analysis, BR-041). */
  @Get("phrases")
  @Roles("admin", "analyst", "viewer")
  phrases(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(PhrasesQuerySchema)) query: PhrasesQuery,
  ): Promise<PhraseSentimentResponse> {
    return this.svc.phrases(projectId, query);
  }
}
