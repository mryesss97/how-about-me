import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ProjectSettings, UserRole } from "@how-about-me/contracts";
import { PrismaService } from "../../database/prisma.service";
import type { ProjectRow } from "./projects.mapper";

export type ProjectUpdateData = { name?: string; timezone?: string; settings?: ProjectSettings };

/** Data access for monitoring_projects — FR-031/FR-032. */
@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-031: only projects the user is a member of, with their role. */
  async listForUser(userId: string): Promise<{ project: ProjectRow; role: UserRole }[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((m) => ({ project: m.project, role: m.role as UserRole }));
  }

  findById(id: string, tx?: Prisma.TransactionClient): Promise<ProjectRow | null> {
    return (tx ?? this.prisma).monitoringProject.findUnique({ where: { id } });
  }

  update(id: string, data: ProjectUpdateData, tx: Prisma.TransactionClient): Promise<ProjectRow> {
    return tx.monitoringProject.update({ where: { id }, data });
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
