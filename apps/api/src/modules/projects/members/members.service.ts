import { Injectable } from "@nestjs/common";
import type { AddMemberBody, Member, UserRole } from "@how-about-me/contracts";
import { AppError } from "../../../common/errors/app.error";
import { AuditService } from "../../audit/audit.service";
import { toMember } from "./members.mapper";
import { MembersRepository } from "./members.repository";
import { SupabaseInviteService } from "./supabase-invite.service";

/** Project members — FR-033 (add), FR-034 (change role/remove), FR-035 (last admin), FR-200 (audit). */
@Injectable()
export class MembersService {
  constructor(
    private readonly repo: MembersRepository,
    private readonly audit: AuditService,
    private readonly invites: SupabaseInviteService,
  ) {}

  async list(projectId: string): Promise<Member[]> {
    return (await this.repo.list(projectId)).map(toMember);
  }

  /** FR-033: add by email; unknown email gets a placeholder profile reconciled on first login (FR-017). */
  async add(projectId: string, body: AddMemberBody, actorUserId: string, requestId: string | null): Promise<Member> {
    const email = body.email.trim().toLowerCase();
    const { member, sendInvite } = await this.repo.transaction(async (tx) => {
      if (!(await this.repo.lockProject(projectId, tx))) throw AppError.notFound("Project");
      const profile = await this.repo.findOrCreateProfile(email, tx);
      if (await this.repo.find(projectId, profile.id, tx))
        throw new AppError("MEMBER_EXISTS", "User is already a member of this project");
      const row = await this.repo.create(
        { projectId, userId: profile.id, role: body.role, invitedEmail: email, createdBy: actorUserId },
        tx,
      );
      await this.audit.record(
        {
          projectId,
          actorUserId,
          action: "member.added",
          entityType: "member",
          entityId: profile.id,
          metadata: { email, role: body.role },
          requestId,
        },
        tx,
      );
      return { member: toMember(row), sendInvite: profile.lastLoginAt === null };
    });
    // After commit, best-effort: never fails the 201.
    if (sendInvite && this.invites.isEnabled()) await this.invites.invite(email);
    return member;
  }

  /** FR-034 / FR-035: takes effect on the next request (ProjectRoleGuard reads membership per request). */
  changeRole(
    projectId: string,
    userId: string,
    role: UserRole,
    actorUserId: string,
    requestId: string | null,
  ): Promise<Member> {
    return this.repo.transaction(async (tx) => {
      await this.repo.lockProject(projectId, tx);
      const current = await this.repo.find(projectId, userId, tx);
      if (!current) throw AppError.notFound("Member");
      if (current.role === role) return toMember(current);
      if (current.role === "admin" && (await this.repo.countAdmins(projectId, tx)) <= 1)
        throw new AppError("LAST_ADMIN", "A project must keep at least one admin");
      const updated = await this.repo.updateRole(projectId, userId, role, tx);
      await this.audit.record(
        {
          projectId,
          actorUserId,
          action: "member.role_changed",
          entityType: "member",
          entityId: userId,
          metadata: { role, previousRole: current.role },
          requestId,
        },
        tx,
      );
      return toMember(updated);
    });
  }

  /** FR-034 / FR-035: removes the membership only; the profile and audit history stay. */
  remove(projectId: string, userId: string, actorUserId: string, requestId: string | null): Promise<void> {
    return this.repo.transaction(async (tx) => {
      await this.repo.lockProject(projectId, tx);
      const current = await this.repo.find(projectId, userId, tx);
      if (!current) throw AppError.notFound("Member");
      if (current.role === "admin" && (await this.repo.countAdmins(projectId, tx)) <= 1)
        throw new AppError("LAST_ADMIN", "A project must keep at least one admin");
      await this.repo.delete(projectId, userId, tx);
      await this.audit.record(
        {
          projectId,
          actorUserId,
          action: "member.removed",
          entityType: "member",
          entityId: userId,
          metadata: { email: current.user.email, previousRole: current.role },
          requestId,
        },
        tx,
      );
    });
  }
}
