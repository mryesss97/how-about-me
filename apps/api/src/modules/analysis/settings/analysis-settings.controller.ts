import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AnalysisSettings, UpdateAnalysisSettingsBody } from "@how-about-me/contracts";
import { UpdateAnalysisSettingsBodySchema } from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../../common/auth/current-user.decorator";
import { Roles } from "../../../common/auth/roles.decorator";
import { zod } from "../../../common/pipes/zod-validation.pipe";
import { AnalysisSettingsService } from "./analysis-settings.service";

/** docs/02-architecture/05-api-contract.md "Analysis settings" — FR-190, FR-200. GET: any member; PATCH: admin (FR-015). */
@ApiTags("analysis-settings")
@ApiBearerAuth()
@Controller("projects/:projectId/settings/analysis")
export class AnalysisSettingsController {
  constructor(private readonly settings: AnalysisSettingsService) {}

  @Get()
  get(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<AnalysisSettings> {
    return this.settings.get(projectId);
  }

  @Patch()
  @Roles("admin")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(UpdateAnalysisSettingsBodySchema)) body: UpdateAnalysisSettingsBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<AnalysisSettings> {
    return this.settings.update(projectId, body, user.id, req.id ?? null);
  }
}
