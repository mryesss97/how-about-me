import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AuditService } from "../../src/modules/audit/audit.service";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-059: audit record + admin list — FR-200, FR-201; TC-SYS-014, TC-SYS-015. */
describe("Audit logs (T-059)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let audit: AuditService;
  let projectId: string;
  let otherProjectId: string;
  type Who = "admin" | "analyst" | "viewer" | "outsider";
  const users = {} as { [K in Who]: { id: string; token: string } };
  const get = (who: keyof typeof users, query = "", pid = projectId) =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${pid}/audit-logs${query}`)
      .set("authorization", `Bearer ${users[who].token}`);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    audit = app.get(AuditService);
  });
  beforeEach(async () => {
    await resetDb(prisma);
    projectId = randomUUID();
    otherProjectId = randomUUID();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "A", slug: `a-${projectId}` } });
    await prisma.monitoringProject.create({ data: { id: otherProjectId, name: "B", slug: `b-${otherProjectId}` } });
    for (const who of ["admin", "analyst", "viewer", "outsider"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email, displayName: who } });
      if (who !== "outsider") await prisma.projectMember.create({ data: { projectId, userId: id, role: who } });
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
  });
  afterAll(async () => app.close());

  it("TC-SYS-014: admin sees actor/action/entity/requestId and no secrets", async () => {
    await audit.record({
      projectId,
      actorUserId: users.admin.id,
      action: "integration.updated",
      entityType: "integration",
      entityId: "int-1",
      metadata: { status: "active", accessToken: "SHOULD_NOT_LEAK", changes: { appSecret: "NOPE", enabled: true } },
      requestId: "req-abc",
    });
    const res = await get("admin");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      action: "integration.updated",
      actor: { id: users.admin.id, displayName: "admin", email: "admin@example.com" },
      entityType: "integration",
      entityId: "int-1",
      requestId: "req-abc",
      metadata: { status: "active", changes: { enabled: true } },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/SHOULD_NOT_LEAK|NOPE/);
    expect(res.body.nextCursor).toBeNull();
  });

  it.each(["analyst", "viewer"] as const)("TC-SYS-015: %s → 403 FORBIDDEN_ROLE", async (who) => {
    const res = await get(who);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("non-member → 403 FORBIDDEN_PROJECT", async () => {
    const res = await get("outsider");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_PROJECT");
  });

  it("filters by action, actor and from/to; other projects never leak", async () => {
    await audit.record({ projectId, actorUserId: users.admin.id, action: "query.created" });
    await audit.record({ projectId, actorUserId: users.analyst.id, action: "query.updated" });
    await audit.record({ projectId: otherProjectId, actorUserId: users.admin.id, action: "query.created" });
    await prisma.auditLog.updateMany({
      where: { action: "query.updated" },
      data: { createdAt: new Date("2026-01-05T00:00:00Z") },
    });

    const byAction = await get("admin", "?action=query.created");
    expect(byAction.body.items.map((i: { action: string }) => i.action)).toEqual(["query.created"]);
    const byActor = await get("admin", `?actorUserId=${users.analyst.id}`);
    expect(byActor.body.items).toHaveLength(1);
    expect(byActor.body.items[0].actor.id).toBe(users.analyst.id);
    const range = await get("admin", "?from=2026-01-01T00:00:00.000Z&to=2026-01-10T00:00:00.000Z&count=true");
    expect(range.body.items.map((i: { action: string }) => i.action)).toEqual(["query.updated"]);
    expect(range.body.totalCount).toBe(1);
    const all = await get("admin");
    expect(all.body.items).toHaveLength(2);
  });

  it("paginates with cursor without duplicates; garbage cursor → 400", async () => {
    for (let i = 0; i < 5; i++) await audit.record({ projectId, actorUserId: null, action: "project.updated" });
    const p1 = await get("admin", "?limit=3");
    expect(p1.body.items).toHaveLength(3);
    expect(p1.body.nextCursor).toEqual(expect.any(String));
    const p2 = await get("admin", `?limit=3&cursor=${p1.body.nextCursor}`);
    expect(p2.body.items).toHaveLength(2);
    expect(p2.body.nextCursor).toBeNull();
    const ids = [...p1.body.items, ...p2.body.items].map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(5);
    expect(p1.body.items[0].actor).toBeNull();

    const bad = await get("admin", "?cursor=garbage");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });
});
