import { Controller, HttpCode, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { ReanalyzeResponse } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { AllowRoleWhenSetting } from "../../common/auth/project-setting-gate.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { MentionsService } from "./mentions.service";

/** docs/02-architecture/05-api-contract.md §7 — FR-115, FR-015. */
@ApiTags("mentions")
@ApiBearerAuth()
@Controller("projects/:projectId/mentions")
export class MentionsController {
  constructor(private readonly mentions: MentionsService) {}

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
