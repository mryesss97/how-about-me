import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  type AnalyticsQuery,
  AnalyticsQuerySchema,
  type IntentsDistributionResponse,
  type SafetyDistributionResponse,
  type SentimentResponse,
  type TopicsDistributionResponse,
} from "@how-about-me/contracts";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { AnalyticsDistributionsService } from "./analytics-distributions.service";

/** docs/02-architecture/05-api-contract.md §6 — FR-136…FR-140. Read-only, every project role. */
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
}
