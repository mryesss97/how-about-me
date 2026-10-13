import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Project, UpdateProjectBody } from "@how-about-me/contracts";
import { UpdateProjectBodySchema } from "@how-about-me/contracts";
import {
  type AuthedRequest,
  type AuthUser,
  CurrentUser,
  ProjectCtx,
  type ProjectContext,
} from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { ProjectsService } from "./projects.service";

/** docs/02-architecture/05-api-contract.md §3 — FR-031, FR-032. Members: ./members (T-035). */
@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Project[]> {
    return this.projects.list(user.id);
  }

  @Get(":projectId")
  get(@Param("projectId", ParseUUIDPipe) projectId: string, @ProjectCtx() ctx: ProjectContext): Promise<Project> {
    return this.projects.get(projectId, ctx.role);
  }

  @Patch(":projectId")
  @Roles("admin")
  update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(UpdateProjectBodySchema)) body: UpdateProjectBody,
    @CurrentUser() user: AuthUser,
    @ProjectCtx() ctx: ProjectContext,
    @Req() req: AuthedRequest,
  ): Promise<Project> {
    return this.projects.update(projectId, body, user.id, ctx.role, req.id ?? null);
  }
}
