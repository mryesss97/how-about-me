import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type AnalyticsQuery, AnalyticsQuerySchema, type OverviewResponse } from "@how-about-me/contracts";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { OverviewService } from "./overview.service";

/** docs/02-architecture/05-api-contract.md (analytics overview) — FR-132/133/134/140. Read-only: any project role. */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("projects/:projectId/analytics")
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get("overview")
  get(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<OverviewResponse> {
    return this.overview.get(projectId, query);
  }
}
