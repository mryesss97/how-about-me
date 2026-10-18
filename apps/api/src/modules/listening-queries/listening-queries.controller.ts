import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateListeningQueryBodySchema,
  type CreateListeningQueryBody,
  type ListeningQuery,
  ListeningQueryListQuerySchema,
  type ListeningQueryListQuery,
  type QueuedJobResponse,
  UpdateListeningQueryBodySchema,
  type UpdateListeningQueryBody,
} from "@how-about-me/contracts";
import { type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { RequestId } from "../../common/logging/request-id.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { SyncJobsService } from "../sync-jobs/sync-jobs.service";
import type { ListeningQueryPage } from "./listening-queries.repository";
import { ListeningQueriesService } from "./listening-queries.service";
import { RejectImmutableFieldsPipe } from "./reject-immutable-fields.pipe";

/** docs/02-architecture/05-api-contract.md §5 — FR-051…FR-057. Mutations admin-only (FR-015, BR-033). */
@ApiTags("listening-queries")
@ApiBearerAuth()
@Controller("projects/:projectId/listening-queries")
export class ListeningQueriesController {
  constructor(
    private readonly service: ListeningQueriesService,
    private readonly syncJobs: SyncJobsService,
  ) {}

  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(ListeningQueryListQuerySchema)) query: ListeningQueryListQuery,
  ): Promise<ListeningQueryPage> {
    return this.service.list(projectId, query);
  }

  @Get(":queryId")
  get(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queryId", ParseUUIDPipe) queryId: string,
  ): Promise<ListeningQuery> {
    return this.service.get(projectId, queryId);
  }

  @Post()
  @Roles("admin")
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(CreateListeningQueryBodySchema)) body: CreateListeningQueryBody,
    @CurrentUser() user: AuthUser,
    @RequestId() requestId: string | null,
  ): Promise<ListeningQuery> {
    return this.service.create({ projectId, user, requestId }, body);
  }

  /** BR-009: immutable-field pipe must run before Zod (which strips unknown keys). */
  @Patch(":queryId")
  @Roles("admin")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queryId", ParseUUIDPipe) queryId: string,
    @Body(new RejectImmutableFieldsPipe(), zod(UpdateListeningQueryBodySchema)) body: UpdateListeningQueryBody,
    @CurrentUser() user: AuthUser,
    @RequestId() requestId: string | null,
  ): Promise<ListeningQuery> {
    return this.service.update({ projectId, user, requestId }, queryId, body);
  }

  @Delete(":queryId")
  @Roles("admin")
  @HttpCode(204)
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queryId", ParseUUIDPipe) queryId: string,
    @CurrentUser() user: AuthUser,
    @RequestId() requestId: string | null,
  ): Promise<void> {
    return this.service.softDelete({ projectId, user, requestId }, queryId);
  }

  @Post(":queryId/restore")
  @Roles("admin")
  @HttpCode(200)
  restore(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queryId", ParseUUIDPipe) queryId: string,
    @CurrentUser() user: AuthUser,
    @RequestId() requestId: string | null,
  ): Promise<ListeningQuery> {
    return this.service.restore({ projectId, user, requestId }, queryId);
  }

  /** T-043 / FR-058 / NFR-017: queue a manual sync job; 409 SYNC_ALREADY_RUNNING, 429 RATE_LIMITED. */
  @Post(":queryId/run")
  @Roles("admin")
  @HttpCode(202)
  run(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("queryId", ParseUUIDPipe) queryId: string,
    @CurrentUser() user: AuthUser,
    @RequestId() requestId: string | null,
  ): Promise<QueuedJobResponse> {
    return this.syncJobs.runNow({ projectId, user, requestId }, queryId);
  }
}
