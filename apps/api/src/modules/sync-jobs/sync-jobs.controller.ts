import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { type SyncJobDetail, SyncJobsListQuerySchema, type SyncJobsListQuery } from "@how-about-me/contracts";
import { type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { RequestId } from "../../common/logging/request-id.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import type { SyncJobsPage } from "./sync-jobs.repository";
import { SyncJobsService } from "./sync-jobs.service";

/** docs/02-architecture/05-api-contract.md §8 — FR-081 (any member reads), FR-175 (admin retry, FR-015). */
@ApiTags("sync-jobs")
@ApiBearerAuth()
@Controller("projects/:projectId/sync-jobs")
export class SyncJobsController {
  constructor(private readonly service: SyncJobsService) {}

  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(SyncJobsListQuerySchema)) query: SyncJobsListQuery,
  ): Promise<SyncJobsPage> {
    return this.service.list(projectId, query);
  }

  @Get(":jobId")
  get(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ): Promise<SyncJobDetail> {
    return this.service.get(projectId, jobId);
  }

  @Post(":jobId/retry")
  @Roles("admin")
  @HttpCode(202)
  retry(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @CurrentUser() user: AuthUser,
    @RequestId() requestId: string | null,
  ): Promise<{ jobId: string; status: "queued" }> {
    return this.service.retry({ projectId, user, requestId }, jobId);
  }
}
