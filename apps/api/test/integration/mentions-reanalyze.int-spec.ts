import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { AnalysisService } from "../../src/modules/analysis/analysis.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-076: single re-analyze — FR-115, FR-116, FR-015, FR-200, BR-003, BR-024; TC-ANA-018/019, TC-MEN-013. */
describe("Mentions reanalyze (T-076)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let version: string;
  let p1: string;
  let p2: string;
  let postId: string;
  let otherPostId: string;
  const users = {} as Record<"admin" | "analyst" | "viewer", { id: string; token: string }>;
  const http = () => request(app.getHttpServer());
  const auth = (who: keyof typeof users) => ({ authorization: `Bearer ${users[who].token}` });
  const url = (pid: string, mid: string) => `/api/v1/projects/${pid}/mentions/${mid}/reanalyze`;

  const createPost = async (projectId: string): Promise<string> => {
    const id = randomUUID();
    await prisma.socialPost.create({
      data: {
        id,
        projectId,
        platform: "threads",
        platformPostId: `tp-${id}`,
        text: "hello",
        publishedAt: new Date("2026-10-01T10:00:00Z"),
        contentHash: "h1",
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
    return id;
  };
  const createRun = (status: "pending" | "processing" | "completed") =>
    prisma.analysisRun.create({
      data: {
        id: randomUUID(),
        postId,
        projectId: p1,
        status,
        trigger: "ingest",
        sourceContentHash: "h1",
        sourceRevision: 1,
        effectiveVersion: version,
      },
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    version = app.get(AnalysisService).effectiveVersion;
  });
  beforeEach(async () => {
    await resetDb(prisma);
    p1 = randomUUID();
    p2 = randomUUID();
    await prisma.monitoringProject.create({ data: { id: p1, name: "P1", slug: `p1-${p1}` } });
    await prisma.monitoringProject.create({ data: { id: p2, name: "P2", slug: `p2-${p2}` } });
    for (const who of ["admin", "analyst", "viewer"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email } });
      await prisma.projectMember.create({ data: { projectId: p1, userId: id, role: who } });
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
    postId = await createPost(p1);
    otherPostId = await createPost(p2);
  });
  afterAll(async () => app.close());

  it("TC-ANA-018 / FR-115 / FR-116 / BR-003: admin → 202, new manual run, old run kept, audit row", async () => {
    const old = await createRun("completed");
    const res = await http().post(url(p1, postId)).set(auth("admin"));
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ runId: expect.any(String), status: "pending" });
    const run = await prisma.analysisRun.findUniqueOrThrow({ where: { id: res.body.runId } });
    expect(run).toMatchObject({ trigger: "manual", status: "pending", requestedBy: users.admin.id, postId });
    expect((await prisma.analysisRun.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("completed");
    expect((await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } })).latestRunStatus).toBe("pending");
    const logs = await prisma.auditLog.findMany({ where: { projectId: p1, action: "analysis.reanalyze_requested" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actorUserId: users.admin.id, entityType: "social_post", entityId: postId });
    expect(logs[0]?.metadata).toEqual({ runId: res.body.runId, effectiveVersion: version });
  });

  it.each(["pending", "processing"] as const)("TC-ANA-019 / BR-024: open %s run → 409, nothing created", async (st) => {
    await createRun(st);
    const res = await http().post(url(p1, postId)).set(auth("admin"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ANALYSIS_ALREADY_PENDING");
    expect(await prisma.analysisRun.count({ where: { postId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "analysis.reanalyze_requested" } })).toBe(0);
  });

  it("BR-024: second consecutive request → 409", async () => {
    expect((await http().post(url(p1, postId)).set(auth("admin"))).status).toBe(202);
    const res = await http().post(url(p1, postId)).set(auth("admin"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ANALYSIS_ALREADY_PENDING");
  });

  it("TC-MEN-013 / FR-015: viewer → 403 FORBIDDEN_ROLE", async () => {
    const res = await http().post(url(p1, postId)).set(auth("viewer"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("FR-015: analyst allowed by default, denied when allowAnalystReanalyze=false", async () => {
    expect((await http().post(url(p1, postId)).set(auth("analyst"))).status).toBe(202);
    await prisma.analysisRun.deleteMany({});
    await prisma.monitoringProject.update({ where: { id: p1 }, data: { settings: { allowAnalystReanalyze: false } } });
    const res = await http().post(url(p1, postId)).set(auth("analyst"));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("404 for a mention of another project or unknown id; 400 for non-UUID id", async () => {
    expect((await http().post(url(p1, otherPostId)).set(auth("admin"))).body.error.code).toBe("NOT_FOUND");
    expect((await http().post(url(p1, randomUUID())).set(auth("admin"))).status).toBe(404);
    expect((await http().post(url(p1, "not-a-uuid")).set(auth("admin"))).status).toBe(400);
  });
});
