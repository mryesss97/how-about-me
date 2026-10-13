import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { UserRole } from "@how-about-me/contracts";
import { PrismaService } from "../../../database/prisma.service";
import type { MemberRow } from "./members.mapper";

export type ProfileRow = { id: string; email: string; lastLoginAt: Date | null };

const MEMBER_INCLUDE = { user: { select: { email: true, displayName: true } } } as const;

/** Data access for project_members / placeholder user_profiles — FR-033..FR-035. */
@Injectable()
export class MembersRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string): Promise<MemberRow[]> {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
  }

  find(projectId: string, userId: string, tx: Prisma.TransactionClient): Promise<MemberRow | null> {
    return tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, include: MEMBER_INCLUDE });
  }

  /**
   * FR-035: serialize every member mutation of a project by row-locking the project.
   * Returns false when the project does not exist.
   */
  async lockProject(projectId: string, tx: Prisma.TransactionClient): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM monitoring_projects WHERE id = ${projectId}::uuid FOR UPDATE`,
    );
    return rows.length > 0;
  }

  countAdmins(projectId: string, tx: Prisma.TransactionClient): Promise<number> {
    return tx.projectMember.count({ where: { projectId, role: "admin" } });
  }

  /**
   * FR-017 lazy profile: returns the profile for `email`, creating a placeholder (never logged in) if missing.
   * `skipDuplicates` (ON CONFLICT DO NOTHING) keeps the tx alive when a concurrent request/login inserts the same email.
   */
  async findOrCreateProfile(email: string, tx: Prisma.TransactionClient): Promise<ProfileRow> {
    const select = { id: true, email: true, lastLoginAt: true } as const;
    const existing = await tx.userProfile.findUnique({ where: { email }, select });
    if (existing) return existing;
    await tx.userProfile.createMany({ data: [{ id: randomUUID(), email }], skipDuplicates: true });
    return tx.userProfile.findUniqueOrThrow({ where: { email }, select });
  }

  create(
    data: { projectId: string; userId: string; role: UserRole; invitedEmail: string; createdBy: string },
    tx: Prisma.TransactionClient,
  ): Promise<MemberRow> {
    return tx.projectMember.create({ data, include: MEMBER_INCLUDE });
  }

  updateRole(projectId: string, userId: string, role: UserRole, tx: Prisma.TransactionClient): Promise<MemberRow> {
    return tx.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
      include: MEMBER_INCLUDE,
    });
  }

  async delete(projectId: string, userId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  }

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
