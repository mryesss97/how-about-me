import { Controller, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MarkStaleQuerySchema, type MarkStaleQuery, type MarkStaleResponse } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { AnalysisRunsService } from "./analysis-runs.service";

/** docs/02-architecture/05-api-contract.md §9 — analysis runs (ops). */
@ApiTags("analysis-runs")
@ApiBearerAuth()
@Controller("projects/:projectId/analysis-runs")
export class AnalysisRunsController {
  constructor(private readonly runs: AnalysisRunsService) {}

  /** T-145 / BR-023: admin only (FR-015, personas §3). */
  @Post("mark-stale")
  @HttpCode(200)
  @Roles("admin")
  markStale(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(MarkStaleQuerySchema)) query: MarkStaleQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<MarkStaleResponse> {
    return this.runs.markStale(projectId, query, user.id, req.id ?? null);
  }
}
