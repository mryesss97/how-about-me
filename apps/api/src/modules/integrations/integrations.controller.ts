import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { PutThreadsIntegrationBody, ThreadsIntegrationStatus } from "@how-about-me/contracts";
import { PutThreadsIntegrationBodySchema } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { IntegrationsService } from "./integrations.service";

/** NFR-017 / T-121: verify calls Threads upstream, so it gets a tighter limit than the global 300/min. */
export const VERIFY_THROTTLE_LIMIT = 5;
export const VERIFY_THROTTLE_TTL_MS = 60_000;

/** Tracks per project (security doc §8: verify 5/min/project); falls back to IP when no project param. */
export function verifyThrottleTracker(req: Record<string, unknown>): string {
  const r = req as Partial<AuthedRequest> & { ip?: string };
  return `verify:${r.params?.projectId ?? r.ip ?? "anon"}`;
}

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
  @Throttle({
    global: { limit: VERIFY_THROTTLE_LIMIT, ttl: VERIFY_THROTTLE_TTL_MS, getTracker: verifyThrottleTracker },
  })
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
