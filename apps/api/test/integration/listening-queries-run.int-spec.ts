import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-043: run-now — FR-058, NFR-017, BR-010, BR-034; TC-LQ-013/014/015. */
describe("Listening query run-now (T-043)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let otherProjectId: string;
  let queryId: string;
  type Who = "admin" | "analyst" | "viewer";
  const users = {} as { [K in Who]: { id: string; token: string } };
  const run = (who: Who, qid = queryId, pid = projectId) =>
    request(app.getHttpServer())
      .post(`/api/v1/projects/${pid}/listening-queries/${qid}/run`)
      .set("authorization", `Bearer ${users[who].token}`);

  async function seedQuery(pid: string, data: { enabled?: boolean; deletedAt?: Date } = {}): Promise<string> {
    const id = randomUUID();
    await prisma.listeningQuery.create({
      data: {
        id,
        projectId: pid,
        displayName: id,
        queryValue: id,
        queryType: "keyword",
        searchMode: "KEYWORD",
        ...data,
      },
    });
    return id;
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDb(prisma);
    projectId = randomUUID();
    otherProjectId = randomUUID();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "A", slug: `a-${projectId}` } });
    await prisma.monitoringProject.create({ data: { id: otherProjectId, name: "B", slug: `b-${otherProjectId}` } });
    for (const who of ["admin", "analyst", "viewer"] as const) {
      const id = randomUUID();
      const email = `${who}@example.com`;
      await prisma.userProfile.create({ data: { id, email, displayName: who } });
      await prisma.projectMember.create({ data: { projectId, userId: id, role: who } });
      await prisma.projectMember.create({ data: { projectId: otherProjectId, userId: id, role: who } });
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
    queryId = await seedQuery(projectId);
  });
  afterAll(async () => app.close());

  it("TC-LQ-013: admin → 202, queued manual job + audit query.run_requested", async () => {
    const res = await run("admin").expect(202);
    expect(res.body).toEqual({ jobId: expect.any(String), status: "queued" });
    const job = await prisma.syncJob.findUniqueOrThrow({ where: { id: res.body.jobId } });
    expect(job).toMatchObject({ projectId, queryId, status: "queued", trigger: "manual", requestedBy: users.admin.id });
    const audit = await prisma.auditLog.findMany({ where: { projectId, action: "query.run_requested" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entityId: queryId, metadata: { jobId: res.body.jobId } });
  });

  it("FR-015: analyst/viewer → 403", async () => {
    await run("analyst").expect(403);
    await run("viewer").expect(403);
    expect(await prisma.syncJob.count()).toBe(0);
  });

  it.each(["running", "queued"] as const)("TC-LQ-014: %s job → 409 SYNC_ALREADY_RUNNING with jobId", async (status) => {
    const busy = randomUUID();
    await prisma.syncJob.create({
      data: { id: busy, projectId, queryId, status, trigger: "scheduled", searchType: "RECENT", searchMode: "KEYWORD" },
    });
    const res = await run("admin").expect(409);
    expect(res.body.error).toMatchObject({ code: "SYNC_ALREADY_RUNNING", details: { jobId: busy } });
    expect(await prisma.syncJob.count()).toBe(1);
  });

  it("404 for unknown query or query of another project; BR-010 deleted → 404, disabled → 400", async () => {
    await run("admin", randomUUID()).expect(404);
    const other = await seedQuery(otherProjectId);
    await run("admin", other).expect(404);
    await run("admin", await seedQuery(projectId, { deletedAt: new Date() })).expect(404);
    const res = await run("admin", await seedQuery(projectId, { enabled: false })).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-LQ-015: 11th call within a minute → 429 + Retry-After; other project unaffected", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await run("admin").expect(202);
      await prisma.syncJob.update({ where: { id: res.body.jobId }, data: { status: "success" } });
    }
    const res = await run("admin").expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    await run("admin", await seedQuery(otherProjectId), otherProjectId).expect(202);
  });

  it("concurrent calls → exactly one 202 and one 409", async () => {
    const codes = (await Promise.all([run("admin"), run("admin")])).map((r) => r.status).sort();
    expect(codes).toEqual([202, 409]);
  });
});
