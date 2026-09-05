import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { v7 as uuidv7 } from "uuid";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

describe("smoke: health, auth, RBAC skeleton", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    await resetDb(prisma);
  });
  afterAll(async () => app.close());

  it("GET /health/live is public", async () => {
    const res = await request(app.getHttpServer()).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /health/ready reports database up", async () => {
    const res = await request(app.getHttpServer()).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.details.database.status).toBe("up");
  });

  it("GET /api/v1/me without token → 401 AUTH_MISSING_TOKEN envelope", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_MISSING_TOKEN");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("tampered token → 401 AUTH_INVALID_TOKEN", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("valid token upserts profile and returns memberships; non-member gets FORBIDDEN_PROJECT", async () => {
    const sub = uuidv7();
    const token = await mintTestJwt({ sub, email: "qa.analyst@example.com", name: "QA Analyst" });
    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("qa.analyst@example.com");
    expect(me.body.projects).toEqual([]);

    const project = await prisma.monitoringProject.create({
      data: { id: uuidv7(), name: "P", slug: `p-${Date.now()}`, settings: {} },
    });
    const forbidden = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN_PROJECT");

    await prisma.projectMember.create({ data: { projectId: project.id, userId: sub, role: "analyst" } });
    const ok = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.role).toBe("analyst");
  });

  it("placeholder profile (invited by email) is re-keyed to auth sub on first login", async () => {
    const project = await prisma.monitoringProject.create({
      data: { id: uuidv7(), name: "P2", slug: `p2-${Date.now()}`, settings: {} },
    });
    const placeholder = await prisma.userProfile.create({ data: { id: uuidv7(), email: "invited@example.com" } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: placeholder.id, role: "viewer" } });

    const sub = uuidv7();
    const token = await mintTestJwt({ sub, email: "invited@example.com" });
    const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(sub);
    expect(me.body.projects[0].role).toBe("viewer");
  });
});
