import { Injectable } from "@nestjs/common";
import type { MeResponse, UserRole } from "@how-about-me/contracts";
import { parseProjectSettings } from "../../common/auth/project-settings";
import { PrismaService } from "../../database/prisma.service";

/** Reads the caller's active project memberships and maps them to contract DTOs (05-api-contract §2). */
@Injectable()
export class MeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveProjects(userId: string): Promise<MeResponse["projects"]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId, project: { isActive: true } },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      slug: m.project.slug,
      timezone: m.project.timezone,
      settings: parseProjectSettings(m.project.settings),
      role: m.role as UserRole,
    }));
  }
}
