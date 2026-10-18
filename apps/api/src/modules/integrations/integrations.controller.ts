import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { PutThreadsIntegrationBody, ThreadsIntegrationStatus } from "@how-about-me/contracts";
import { PutThreadsIntegrationBodySchema } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { IntegrationsService } from "./integrations.service";

/** docs/02-architecture/05-api-contract.md §4 — FR-040..FR-044. Mutations are admin-only (FR-015). */
@ApiTags("integrations")
@ApiBearerAuth()
@Controller("projects/:projectId/integrations/threads")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  get(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<ThreadsIntegrationStatus> {
    return this.integrations.getThreads(projectId);
  }

  @Put()
  @Roles("admin")
  put(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(PutThreadsIntegrationBodySchema)) body: PutThreadsIntegrationBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<ThreadsIntegrationStatus> {
    return this.integrations.putThreadsToken(projectId, body, user.id, req.id ?? null);
  }

  @Post("verify")
  @HttpCode(200)
  @Roles("admin")
  verify(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<ThreadsIntegrationStatus> {
    return this.integrations.verifyThreads(projectId, user.id, req.id ?? null);
  }

  @Delete()
  @HttpCode(204)
  @Roles("admin")
  disconnect(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<void> {
    return this.integrations.disconnectThreads(projectId, user.id, req.id ?? null);
  }
}
