import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Project, UserRole } from "@how-about-me/contracts";
import { ProjectSettingsSchema } from "@how-about-me/contracts";
import { CurrentUser, type AuthUser, ProjectCtx, type ProjectContext } from "../../common/auth/current-user.decorator";
import { AppError } from "../../common/errors/app.error";
import { PrismaService } from "../../database/prisma.service";

/** docs/02-architecture/05-api-contract.md §3 — PATCH/members are implemented in T-034/T-035. */
@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
export class ProjectsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<Project[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { userId: user.id },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((m) => toProject(m.project, m.role as UserRole));
  }

  @Get(":projectId")
  async get(@Param("projectId", ParseUUIDPipe) projectId: string, @ProjectCtx() ctx: ProjectContext): Promise<Project> {
    const p = await this.prisma.monitoringProject.findUnique({ where: { id: projectId } });
    if (!p) throw AppError.notFound("Project");
    return toProject(p, ctx.role);
  }
}

type Row = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  settings: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export function toProject(p: Row, role?: UserRole): Project {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    timezone: p.timezone,
    settings: ProjectSettingsSchema.parse(p.settings ?? {}),
    isActive: p.isActive,
    role,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
