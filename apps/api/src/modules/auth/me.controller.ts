import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { MeResponse, ProjectSettings, UserRole } from "@how-about-me/contracts";
import { ProjectSettingsSchema } from "@how-about-me/contracts";
import { CurrentUser, type AuthUser } from "../../common/auth/current-user.decorator";
import { PrismaService } from "../../database/prisma.service";

/** `GET /api/v1/me` — docs/02-architecture/05-api-contract.md §2 */
@ApiTags("auth")
@ApiBearerAuth()
@Controller("me")
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: user.id, project: { isActive: true } },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      projects: memberships.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        slug: m.project.slug,
        timezone: m.project.timezone,
        settings: ProjectSettingsSchema.parse(m.project.settings ?? {}) as ProjectSettings,
        role: m.role as UserRole,
      })),
    };
  }
}
