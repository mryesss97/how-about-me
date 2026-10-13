import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type TimeseriesQuery, TimeseriesQuerySchema, type TimeseriesResponse } from "@how-about-me/contracts";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { AnalyticsTimeseriesService } from "./analytics-timeseries.service";

/** docs/02-architecture/05-api-contract.md §6 mentions-timeseries — FR-135, FR-141. Read for every project role. */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("projects/:projectId/analytics")
export class AnalyticsTimeseriesController {
  constructor(private readonly service: AnalyticsTimeseriesService) {}

  @Get("mentions-timeseries")
  @Roles("admin", "analyst", "viewer")
  mentionsTimeseries(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(TimeseriesQuerySchema)) query: TimeseriesQuery,
  ): Promise<TimeseriesResponse> {
    return this.service.mentionsTimeseries(projectId, query);
  }
}
