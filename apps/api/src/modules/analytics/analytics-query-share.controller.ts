import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type AnalyticsQuery, AnalyticsQuerySchema, type QueryShareResponse } from "@how-about-me/contracts";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { AnalyticsQueryShareService } from "./analytics-query-share.service";

/** docs/02-architecture/05-api-contract.md §6 — FR-145 keyword share. Read-only, every project role (FR-015). */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("projects/:projectId/analytics")
export class AnalyticsQueryShareController {
  constructor(private readonly svc: AnalyticsQueryShareService) {}

  @Get("query-share")
  @Roles("admin", "analyst", "viewer")
  queryShare(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalyticsQuerySchema)) query: AnalyticsQuery,
  ): Promise<QueryShareResponse> {
    return this.svc.queryShare(projectId, query);
  }
}
