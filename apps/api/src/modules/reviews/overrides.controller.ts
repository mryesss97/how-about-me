import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateOverrideBodySchema, type CreateOverrideBody, type Override } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { OverridesService } from "./overrides.service";

/** docs/02-architecture/05-api-contract.md §7 — T-142, FR-191/193, FR-015 (admin · analyst). */
@ApiTags("reviews")
@ApiBearerAuth()
@Controller("projects/:projectId/mentions/:mentionId/overrides")
export class OverridesController {
  constructor(private readonly overrides: OverridesService) {}

  @Post()
  @HttpCode(201)
  @Roles("admin", "analyst")
  create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("mentionId", ParseUUIDPipe) mentionId: string,
    @Body(zod(CreateOverrideBodySchema)) body: CreateOverrideBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<Override> {
    return this.overrides.create(projectId, mentionId, body, user.id, req.id ?? null);
  }

  @Delete(":overrideId")
  @HttpCode(204)
  @Roles("admin", "analyst")
  revoke(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("mentionId", ParseUUIDPipe) mentionId: string,
    @Param("overrideId", ParseUUIDPipe) overrideId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<void> {
    return this.overrides.revoke(projectId, mentionId, overrideId, user.id, req.id ?? null);
  }
}
