import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AnalysisRunsListQuerySchema,
  MarkStaleQuerySchema,
  RetryFailedBodySchema,
  type AnalysisRunsListQuery,
  type MarkStaleQuery,
  type MarkStaleResponse,
  type RetryFailedBody,
} from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import type { AnalysisRunsPage } from "./analysis-runs.repository";
import { AnalysisRunsService } from "./analysis-runs.service";

/** docs/02-architecture/05-api-contract.md §9 — analysis runs (ops). */
@ApiTags("analysis-runs")
@ApiBearerAuth()
@Controller("projects/:projectId/analysis-runs")
export class AnalysisRunsController {
  constructor(private readonly runs: AnalysisRunsService) {}

  /** T-077 / FR-175: any project member (membership guard). */
  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AnalysisRunsListQuerySchema)) query: AnalysisRunsListQuery,
  ): Promise<AnalysisRunsPage> {
    return this.runs.list(projectId, query);
  }

  /** T-077 / FR-175: bulk retry of failed runs, admin only (FR-015). */
  @Post("retry-failed")
  @HttpCode(200)
  @Roles("admin")
  retryFailed(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(RetryFailedBodySchema)) body: RetryFailedBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<{ enqueued: number }> {
    return this.runs.retryFailed(projectId, body, user.id, req.id ?? null);
  }

  /** T-077 / FR-175: retry one failed run in place, admin only (FR-015, BR-024). */
  @Post(":id/retry")
  @HttpCode(202)
  @Roles("admin")
  retry(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<{ runId: string; status: "pending" }> {
    return this.runs.retry(projectId, id, user.id, req.id ?? null);
  }

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
