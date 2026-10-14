import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type LandingTermsQuery, LandingTermsQuerySchema, type LandingTermsResponse } from "@how-about-me/contracts";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { AnalyticsLandingService } from "./analytics-landing.service";

/** docs/02-architecture/05-api-contract.md §6 — FR-149, BR-042 landing terms. Read-only, every project role (FR-015). */
@ApiTags("analytics")
@ApiBearerAuth()
@Controller("projects/:projectId/analytics")
export class AnalyticsLandingController {
  constructor(private readonly svc: AnalyticsLandingService) {}

  @Get("landing-terms")
  @Roles("admin", "analyst", "viewer")
  landingTerms(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(LandingTermsQuerySchema)) query: LandingTermsQuery,
  ): Promise<LandingTermsResponse> {
    return this.svc.landingTerms(projectId, query);
  }
}
