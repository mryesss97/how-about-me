import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

type Who = "admin" | "admin2" | "analyst" | "viewer";

/** T-035: members — FR-033, FR-034, FR-035, FR-017, FR-200; TC-PROJ-007..011. */
describe("Members (T-035)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pid: string;
  const users = {} as Record<Who, { id: string; token: string }>;
  const http = () => request(app.getHttpServer());
  const auth = (who: Who) => ({ authorization: `Bearer ${users[who].token}` });
  const base = () => `/api/v1/projects/${pid}/members`;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDb(prisma);
    pid = randomUUID();
    await prisma.monitoringProject.create({ data: { id: pid, name: "P", slug: `p-${pid}` } });
    for (const who of ["admin", "admin2", "analyst", "viewer"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email, lastLoginAt: new Date() } });
      if (who !== "admin2") {
        await prisma.projectMember.create({ data: { projectId: pid, userId: id, role: who } });
      }
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
  });
  afterAll(async () => app.close());

  it("TC-PROJ-007: POST new email → 201, placeholder profile, audit member.added; GET lists it", async () => {
    const res = await http().post(base()).set(auth("admin")).send({ email: "New@Example.com", role: "analyst" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "new@example.com", role: "analyst", displayName: null });
    const profile = await prisma.userProfile.findUnique({ where: { email: "new@example.com" } });
    expect(profile?.lastLoginAt).toBeNull();
    const logs = await prisma.auditLog.findMany({ where: { projectId: pid, action: "member.added" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorUserId: users.admin.id, entityType: "member", entityId: profile?.id });
    const list = await http().get(base()).set(auth("admin"));
    expect(list.status).toBe(200);
    expect(list.body.map((m: { email: string }) => m.email)).toContain("new@example.com");
  });

  it("FR-033: POST existing member email → 409 MEMBER_EXISTS", async () => {
    const res = await http().post(base()).set(auth("admin")).send({ email: "analyst@example.com", role: "viewer" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MEMBER_EXISTS");
  });

  it("TC-PROJ-008: placeholder is reconciled on first login and sees the project with role", async () => {
    await http().post(base()).set(auth("admin")).send({ email: "fresh@example.com", role: "viewer" }).expect(201);
    const sub = randomUUID();
    const token = await mintTestJwt({ sub, email: "fresh@example.com" });
    const res = await http()
      .get("/api/v1/projects")
      .set({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: pid, role: "viewer" })]);
    expect(
      await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: pid, userId: sub } } }),
    ).not.toBeNull();
  });

  it("TC-PROJ-009: PATCH analyst→viewer takes effect on next request", async () => {
    const res = await http().patch(`${base()}/${users.analyst.id}`).set(auth("admin")).send({ role: "viewer" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("viewer");
    const logs = await prisma.auditLog.findMany({ where: { projectId: pid, action: "member.role_changed" } });
    expect(logs[0]?.metadata).toEqual({ role: "viewer", previousRole: "analyst" });
    // No analyst-only route is implemented yet: assert the new role is served on the next request instead.
    const next = await http().get(`/api/v1/projects/${pid}`).set(auth("analyst"));
    expect(next.body.role).toBe("viewer");
    // And a promotion grants admin-only access immediately.
    await http().patch(`${base()}/${users.viewer.id}`).set(auth("admin")).send({ role: "admin" }).expect(200);
    expect((await http().get(base()).set(auth("viewer"))).status).toBe(200);
  });

  it("TC-PROJ-010: DELETE → 204, next request 403 FORBIDDEN_PROJECT", async () => {
    const res = await http().delete(`${base()}/${users.viewer.id}`).set(auth("admin"));
    expect(res.status).toBe(204);
    expect(await prisma.auditLog.count({ where: { projectId: pid, action: "member.removed" } })).toBe(1);
    const next = await http().get(`/api/v1/projects/${pid}`).set(auth("viewer"));
    expect(next.status).toBe(403);
    expect(next.body.error.code).toBe("FORBIDDEN_PROJECT");
  });

  it("TC-PROJ-011: sole admin cannot demote or remove self → 409 LAST_ADMIN", async () => {
    const patch = await http().patch(`${base()}/${users.admin.id}`).set(auth("admin")).send({ role: "viewer" });
    expect(patch.status).toBe(409);
    expect(patch.body.error.code).toBe("LAST_ADMIN");
    const del = await http().delete(`${base()}/${users.admin.id}`).set(auth("admin"));
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe("LAST_ADMIN");
  });

  it("FR-034: unknown member → 404 NOT_FOUND", async () => {
    const res = await http().patch(`${base()}/${randomUUID()}`).set(auth("admin")).send({ role: "viewer" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("FR-035 concurrency: two admins demoting each other → exactly one succeeds", async () => {
    await prisma.projectMember.create({ data: { projectId: pid, userId: users.admin2.id, role: "admin" } });
    const [a, b] = await Promise.all([
      http().patch(`${base()}/${users.admin2.id}`).set(auth("admin")).send({ role: "viewer" }),
      http().patch(`${base()}/${users.admin.id}`).set(auth("admin2")).send({ role: "viewer" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    expect(await prisma.projectMember.count({ where: { projectId: pid, role: "admin" } })).toBe(1);
  });

  it.each(["analyst", "viewer"] as const)("FR-015: %s gets 403 FORBIDDEN_ROLE on all member routes", async (who) => {
    const id = users.viewer.id;
    for (const res of [
      await http().get(base()).set(auth(who)),
      await http().post(base()).set(auth(who)).send({ email: "x@example.com", role: "viewer" }),
      await http().patch(`${base()}/${id}`).set(auth(who)).send({ role: "analyst" }),
      await http().delete(`${base()}/${id}`).set(auth(who)),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    }
  });
});
