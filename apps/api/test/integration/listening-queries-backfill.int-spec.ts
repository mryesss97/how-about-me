import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

const DAY = 86_400_000;

/** T-140: backfill — FR-063, FR-015, BR-008, BR-010, BR-034; TC-LQ-022. */
describe("Listening query backfill (T-140)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let otherProjectId: string;
  let queryId: string;
  type Who = "admin" | "analyst" | "viewer";
  const users = {} as { [K in Who]: { id: string; token: string } };
  const until = new Date(Date.now() - DAY);
  const since = new Date(until.getTime() - 7 * DAY);
  const validBody = { since: since.toISOString(), until: until.toISOString(), searchType: "TOP" };
  const backfill = (who: Who, body: object = validBody, qid = queryId, pid = projectId) =>
    request(app.getHttpServer())
      .post(`/api/v1/projects/${pid}/listening-queries/${qid}/backfill`)
      .set("authorization", `Bearer ${users[who].token}`)
      .send(body);

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

  it("TC-LQ-022: admin → 202, queued backfill job with window + searchType, audit query.backfill_requested", async () => {
    const res = await backfill("admin").expect(202);
    expect(res.body).toEqual({ jobId: expect.any(String), status: "queued" });
    const job = await prisma.syncJob.findUniqueOrThrow({ where: { id: res.body.jobId } });
    expect(job).toMatchObject({
      projectId,
      queryId,
      status: "queued",
      trigger: "backfill",
      searchType: "TOP",
      windowSince: since,
      windowUntil: until,
      lastCursor: null,
      requestedBy: users.admin.id,
    });
    const audit = await prisma.auditLog.findMany({ where: { projectId, action: "query.backfill_requested" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      entityId: queryId,
      metadata: { jobId: res.body.jobId, since: validBody.since, until: validBody.until, searchType: "TOP" },
    });
  });

  it("searchType defaults to RECENT", async () => {
    const res = await backfill("admin", { since: validBody.since, until: validBody.until }).expect(202);
    expect((await prisma.syncJob.findUniqueOrThrow({ where: { id: res.body.jobId } })).searchType).toBe("RECENT");
  });

  it("FR-015: analyst/viewer → 403", async () => {
    await backfill("analyst").expect(403);
    await backfill("viewer").expect(403);
    expect(await prisma.syncJob.count()).toBe(0);
  });

  it.each([
    ["until == since", { since: validBody.since, until: validBody.since }],
    ["until < since", { since: validBody.until, until: validBody.since }],
    ["over max days", { since: new Date(until.getTime() - 31 * DAY).toISOString(), until: validBody.until }],
    ["until in the future", { since: validBody.since, until: new Date(Date.now() + DAY).toISOString() }],
  ])("TC-LQ-022: %s → 400 BACKFILL_WINDOW_INVALID envelope", async (_name, body) => {
    const res = await backfill("admin", body).expect(400);
    expect(res.body.error).toMatchObject({ code: "BACKFILL_WINDOW_INVALID", requestId: expect.any(String) });
    expect(await prisma.syncJob.count()).toBe(0);
  });

  it("malformed body → 400 VALIDATION_ERROR", async () => {
    expect((await backfill("admin", { since: validBody.since }).expect(400)).body.error.code).toBe("VALIDATION_ERROR");
    const bad = { ...validBody, searchType: "HOT" };
    expect((await backfill("admin", bad).expect(400)).body.error.code).toBe("VALIDATION_ERROR");
  });

  it("active job → 409 SYNC_ALREADY_RUNNING with jobId", async () => {
    const busy = randomUUID();
    await prisma.syncJob.create({
      data: {
        id: busy,
        projectId,
        queryId,
        status: "running",
        trigger: "scheduled",
        searchType: "RECENT",
        searchMode: "KEYWORD",
      },
    });
    const res = await backfill("admin").expect(409);
    expect(res.body.error).toMatchObject({ code: "SYNC_ALREADY_RUNNING", details: { jobId: busy } });
  });

  it("404 for unknown / other-project / deleted query; BR-010 disabled → 400", async () => {
    await backfill("admin", validBody, randomUUID()).expect(404);
    await backfill("admin", validBody, await seedQuery(otherProjectId)).expect(404);
    await backfill("admin", validBody, await seedQuery(projectId, { deletedAt: new Date() })).expect(404);
    const res = await backfill("admin", validBody, await seedQuery(projectId, { enabled: false })).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
