import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  MentionsListQuerySchema,
  type MentionDetail,
  type MentionsListQuery,
  type MentionsPage,
  type ReanalyzeResponse,
} from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { AllowRoleWhenSetting } from "../../common/auth/project-setting-gate.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { MentionsService } from "./mentions.service";

/** docs/02-architecture/05-api-contract.md §7 — FR-115, FR-015. */
@ApiTags("mentions")
@ApiBearerAuth()
@Controller("projects/:projectId/mentions")
export class MentionsController {
  constructor(private readonly mentions: MentionsService) {}

  /** FR-150/152/153/161 — read for all project roles (no @Roles; ProjectRoleGuard enforces membership). */
  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(MentionsListQuerySchema)) query: MentionsListQuery,
  ): Promise<MentionsPage> {
    return this.mentions.list(projectId, query);
  }

  /**
   * FR-154 — read for all project roles. Keep static GET routes (e.g. `export.csv`) declared ABOVE this one,
   * otherwise `:mentionId` shadows them (Nest matches in declaration order).
   */
  @Get(":mentionId")
  detail(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("mentionId", ParseUUIDPipe) mentionId: string,
  ): Promise<MentionDetail> {
    return this.mentions.detail(projectId, mentionId);
  }

  @Post(":mentionId/reanalyze")
  @HttpCode(202)
  @Roles("admin", "analyst")
  @AllowRoleWhenSetting("analyst", "allowAnalystReanalyze")
  reanalyze(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("mentionId", ParseUUIDPipe) mentionId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<ReanalyzeResponse> {
    return this.mentions.reanalyze(projectId, mentionId, user.id, req.id ?? null);
  }
}
