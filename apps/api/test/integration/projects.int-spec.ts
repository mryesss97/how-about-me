import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-034: projects list/get/patch — FR-031, FR-032, FR-200; TC-PROJ-003..006. */
describe("Projects (T-034)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let p1: string;
  let p2: string;
  const users = {} as Record<"admin" | "analyst", { id: string; token: string }>;
  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof users) => ({ authorization: `Bearer ${users[who].token}` });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDb(prisma);
    p1 = randomUUID();
    p2 = randomUUID();
    await prisma.monitoringProject.create({ data: { id: p1, name: "P1", slug: `p1-${p1}` } });
    await prisma.monitoringProject.create({ data: { id: p2, name: "P2", slug: `p2-${p2}` } });
    for (const who of ["admin", "analyst"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email } });
      await prisma.projectMember.create({ data: { projectId: p1, userId: id, role: who } });
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
  });
  afterAll(async () => app.close());

  it("TC-PROJ-003: analyst lists only own projects with role", async () => {
    const res = await http().get("/api/v1/projects").set(auth("analyst"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: p1, role: "analyst" });
  });

  it("TC-PROJ-004: admin PATCH timezone → 200, audit row, GET returns new tz", async () => {
    const res = await http().patch(`/api/v1/projects/${p1}`).set(auth("admin")).send({ timezone: "Asia/Bangkok" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: p1, timezone: "Asia/Bangkok", role: "admin" });
    const logs = await prisma.auditLog.findMany({ where: { projectId: p1, action: "project.updated" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorUserId: users.admin.id, entityType: "project", entityId: p1 });
    expect(logs[0]?.metadata).toEqual({ changes: { timezone: { from: "Asia/Ho_Chi_Minh", to: "Asia/Bangkok" } } });
    const get = await http().get(`/api/v1/projects/${p1}`).set(auth("analyst"));
    expect(get.body.timezone).toBe("Asia/Bangkok");
  });

  it("TC-PROJ-005: invalid timezone → 400 VALIDATION_ERROR", async () => {
    const res = await http().patch(`/api/v1/projects/${p1}`).set(auth("admin")).send({ timezone: "Mars/Olympus" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-PROJ-006: partial settings patch is reflected in /me and keeps other keys", async () => {
    const body = { settings: { allowViewerExport: true } };
    const res = await http().patch(`/api/v1/projects/${p1}`).set(auth("admin")).send(body);
    expect(res.status).toBe(200);
    const me = await http().get("/api/v1/me").set(auth("analyst"));
    expect(me.body.projects[0].settings).toEqual({
      allowAnalystReanalyze: true,
      allowViewerExport: true,
      phraseMinMentions: 2,
    });
  });

  it("TC-PROJ-015 / FR-032 (#251): admin PATCH phraseMinMentions → 200, audit, /me + GET reflect, toggles kept", async () => {
    const res = await http()
      .patch(`/api/v1/projects/${p1}`)
      .set(auth("admin"))
      .send({ settings: { phraseMinMentions: 5 } });
    expect(res.status).toBe(200);
    expect(res.body.settings).toEqual({ allowAnalystReanalyze: true, allowViewerExport: false, phraseMinMentions: 5 });
    const logs = await prisma.auditLog.findMany({ where: { projectId: p1, action: "project.updated" } });
    expect(logs[0]?.metadata).toEqual({ changes: { "settings.phraseMinMentions": { from: 2, to: 5 } } });
    const get = await http().get(`/api/v1/projects/${p1}`).set(auth("analyst"));
    expect(get.body.settings.phraseMinMentions).toBe(5);
    const me = await http().get("/api/v1/me").set(auth("analyst"));
    expect(me.body.projects[0].settings.phraseMinMentions).toBe(5);
  });

  it.each([0, 51, 2.5, "5"])("TC-PROJ-015 (#251): phraseMinMentions %p → 400 VALIDATION_ERROR", async (value) => {
    const res = await http()
      .patch(`/api/v1/projects/${p1}`)
      .set(auth("admin"))
      .send({ settings: { phraseMinMentions: value } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-PROJ-015 (#251): analyst PATCH phraseMinMentions → 403 FORBIDDEN_ROLE", async () => {
    const res = await http()
      .patch(`/api/v1/projects/${p1}`)
      .set(auth("analyst"))
      .send({ settings: { phraseMinMentions: 5 } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("FR-032: analyst PATCH → 403 FORBIDDEN_ROLE", async () => {
    const res = await http().patch(`/api/v1/projects/${p1}`).set(auth("analyst")).send({ name: "X" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });
});
