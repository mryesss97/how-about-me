import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AddMemberBody, Member, UpdateMemberBody } from "@how-about-me/contracts";
import { AddMemberBodySchema, UpdateMemberBodySchema } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../../common/auth/current-user.decorator";
import { Roles } from "../../../common/auth/roles.decorator";
import { zod } from "../../../common/pipes/zod-validation.pipe";
import { MembersService } from "./members.service";

/** docs/02-architecture/05-api-contract.md §3 members — FR-033..FR-035, admin only (FR-015). */
@ApiTags("members")
@ApiBearerAuth()
@Controller("projects/:projectId/members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Roles("admin")
  list(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<Member[]> {
    return this.members.list(projectId);
  }

  @Post()
  @HttpCode(201)
  @Roles("admin")
  add(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(AddMemberBodySchema)) body: AddMemberBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<Member> {
    return this.members.add(projectId, body, user.id, req.id ?? null);
  }

  @Patch(":userId")
  @Roles("admin")
  changeRole(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body(zod(UpdateMemberBodySchema)) body: UpdateMemberBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<Member> {
    return this.members.changeRole(projectId, userId, body.role, user.id, req.id ?? null);
  }

  @Delete(":userId")
  @HttpCode(204)
  @Roles("admin")
  remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<void> {
    return this.members.remove(projectId, userId, user.id, req.id ?? null);
  }
}
