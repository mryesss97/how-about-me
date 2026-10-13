import type { Prisma } from "@prisma/client";
import type { AuditService } from "../../audit/audit.service";
import type { MemberRow } from "./members.mapper";
import type { MembersRepository, ProfileRow } from "./members.repository";
import { MembersService } from "./members.service";
import type { SupabaseInviteService } from "./supabase-invite.service";

const PID = "00000000-0000-7000-8000-000000000001";
const ACTOR = "00000000-0000-7000-8000-000000000002";
const UID = "00000000-0000-7000-8000-000000000003";
const member = (over: Partial<MemberRow> = {}): MemberRow => ({
  userId: UID,
  role: "analyst",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  user: { email: "a@example.com", displayName: null },
  ...over,
});

function setup(opts: { existing?: MemberRow | null; profile?: ProfileRow; admins?: number; inviteOn?: boolean } = {}) {
  const tx = {} as Prisma.TransactionClient;
  const profile = opts.profile ?? { id: UID, email: "a@example.com", lastLoginAt: null };
  const repo = {
    lockProject: jest.fn().mockResolvedValue(true),
    find: jest.fn().mockResolvedValue(opts.existing ?? null),
    findOrCreateProfile: jest.fn().mockResolvedValue(profile),
    countAdmins: jest.fn().mockResolvedValue(opts.admins ?? 1),
    create: jest.fn((d: { role: string }) => Promise.resolve(member({ role: d.role }))),
    updateRole: jest.fn((_p: string, _u: string, role: string) => Promise.resolve(member({ role }))),
    delete: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const invites = {
    isEnabled: jest.fn().mockReturnValue(opts.inviteOn ?? false),
    invite: jest.fn().mockResolvedValue(true),
  };
  const svc = new MembersService(
    repo as unknown as MembersRepository,
    audit as unknown as AuditService,
    invites as unknown as SupabaseInviteService,
  );
  return { svc, repo, audit, invites, tx };
}

describe("MembersService.add (FR-033)", () => {
  it("normalizes email, creates membership and audits member.added in the tx", async () => {
    const { svc, repo, audit, tx } = setup();
    const res = await svc.add(PID, { email: "  A@Example.COM ", role: "analyst" }, ACTOR, "r1");
    expect(repo.findOrCreateProfile).toHaveBeenCalledWith("a@example.com", tx);
    expect(repo.create).toHaveBeenCalledWith(
      { projectId: PID, userId: UID, role: "analyst", invitedEmail: "a@example.com", createdBy: ACTOR },
      tx,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.added",
        entityType: "member",
        entityId: UID,
        metadata: { email: "a@example.com", role: "analyst" },
      }),
      tx,
    );
    expect(res).toMatchObject({ userId: UID, role: "analyst", createdAt: "2026-01-01T00:00:00.000Z" });
  });

  it("409 MEMBER_EXISTS when already a member — no insert, no audit", async () => {
    const { svc, repo, audit } = setup({ existing: member() });
    await expect(svc.add(PID, { email: "a@example.com", role: "viewer" }, ACTOR, null)).rejects.toMatchObject({
      code: "MEMBER_EXISTS",
    });
    expect(repo.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("404 when project does not exist", async () => {
    const { svc, repo } = setup();
    repo.lockProject.mockResolvedValue(false);
    await expect(svc.add(PID, { email: "a@example.com", role: "viewer" }, ACTOR, null)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("sends invite only when enabled and profile never logged in", async () => {
    const on = setup({ inviteOn: true });
    await on.svc.add(PID, { email: "a@example.com", role: "viewer" }, ACTOR, null);
    expect(on.invites.invite).toHaveBeenCalledWith("a@example.com");

    const off = setup({ inviteOn: false });
    await off.svc.add(PID, { email: "a@example.com", role: "viewer" }, ACTOR, null);
    expect(off.invites.invite).not.toHaveBeenCalled();

    const known = setup({ inviteOn: true, profile: { id: UID, email: "a@example.com", lastLoginAt: new Date() } });
    await known.svc.add(PID, { email: "a@example.com", role: "viewer" }, ACTOR, null);
    expect(known.invites.invite).not.toHaveBeenCalled();
  });

  it("invite failure does not fail the request", async () => {
    const { svc, invites } = setup({ inviteOn: true });
    invites.invite.mockResolvedValue(false);
    await expect(svc.add(PID, { email: "a@example.com", role: "viewer" }, ACTOR, null)).resolves.toBeDefined();
  });
});

describe("MembersService.changeRole (FR-034, FR-035)", () => {
  it("404 when not a member", async () => {
    const { svc } = setup();
    await expect(svc.changeRole(PID, UID, "viewer", ACTOR, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("same role is a no-op without audit", async () => {
    const { svc, repo, audit } = setup({ existing: member() });
    await svc.changeRole(PID, UID, "analyst", ACTOR, null);
    expect(repo.updateRole).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("FR-035: demoting the only admin → LAST_ADMIN", async () => {
    const { svc, repo } = setup({ existing: member({ role: "admin" }), admins: 1 });
    await expect(svc.changeRole(PID, UID, "viewer", ACTOR, null)).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it("FR-035: demoting an admin is allowed when another admin remains; audits role_changed", async () => {
    const { svc, audit, tx } = setup({ existing: member({ role: "admin" }), admins: 2 });
    const res = await svc.changeRole(PID, UID, "viewer", ACTOR, "r1");
    expect(res.role).toBe("viewer");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.role_changed", metadata: { role: "viewer", previousRole: "admin" } }),
      tx,
    );
  });
});

describe("MembersService.remove (FR-034, FR-035)", () => {
  it("FR-035: removing the only admin → LAST_ADMIN", async () => {
    const { svc, repo } = setup({ existing: member({ role: "admin" }), admins: 1 });
    await expect(svc.remove(PID, UID, ACTOR, null)).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("removes a non-admin and audits member.removed", async () => {
    const { svc, repo, audit, tx } = setup({ existing: member() });
    await svc.remove(PID, UID, ACTOR, null);
    expect(repo.delete).toHaveBeenCalledWith(PID, UID, tx);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "member.removed",
        metadata: { email: "a@example.com", previousRole: "analyst" },
      }),
      tx,
    );
  });

  it("404 when not a member", async () => {
    const { svc } = setup();
    await expect(svc.remove(PID, UID, ACTOR, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
