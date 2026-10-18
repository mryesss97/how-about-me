import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";

/** T-055: sync jobs list/detail/retry — FR-081, FR-175; TC-COL-016, TC-SYS-011. */
describe("Sync jobs (T-055)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let otherProjectId: string;
  let queryA: string;
  let queryB: string;
  type Who = "admin" | "analyst" | "viewer";
  const users = {} as { [K in Who]: { id: string; token: string } };
  const http = () => request(app.getHttpServer());
  const base = (pid = projectId) => `/api/v1/projects/${pid}/sync-jobs`;
  const get = (who: Who, path = "") =>
    http().get(`${base()}${path}`).set("authorization", `Bearer ${users[who].token}`);
  const retry = (who: Who, id: string) =>
    http().post(`${base()}/${id}/retry`).set("authorization", `Bearer ${users[who].token}`);

  async function seedQuery(pid: string): Promise<string> {
    const id = randomUUID();
    await prisma.listeningQuery.create({
      data: { id, projectId: pid, displayName: id, queryValue: id, queryType: "keyword", searchMode: "KEYWORD" },
    });
    return id;
  }

  async function seedJob(data: Partial<Prisma.SyncJobUncheckedCreateInput> = {}): Promise<string> {
    const id = randomUUID();
    await prisma.syncJob.create({
      data: {
        id,
        projectId,
        queryId: queryA,
        status: "success",
        trigger: "scheduled",
        searchType: "RECENT",
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
      users[who] = { id, token: await mintTestJwt({ sub: id, email }) };
    }
    queryA = await seedQuery(projectId);
    queryB = await seedQuery(projectId);
  });
  afterAll(async () => app.close());

  it("TC-COL-016: filters by status, trigger, queryId and from/to", async () => {
    const failed = await seedJob({ status: "failed", createdAt: new Date("2026-10-01T00:00:00Z") });
    const partial = await seedJob({ status: "partial", queryId: queryB, createdAt: new Date("2026-10-02T00:00:00Z") });
    const manual = await seedJob({ trigger: "manual", createdAt: new Date("2026-10-03T00:00:00Z") });
    await seedJob({ projectId: otherProjectId, queryId: null, status: "failed" });

    const ids = async (q: string) => ((await get("viewer", q)).body.items as { id: string }[]).map((i) => i.id);
    expect(await ids("?status=failed")).toEqual([failed]);
    expect(await ids("?status=failed,partial")).toEqual([partial, failed]);
    expect(await ids("?trigger=manual")).toEqual([manual]);
    expect(await ids(`?queryId=${queryB}`)).toEqual([partial]);
    expect(await ids("?from=2026-10-02T00:00:00Z&to=2026-10-03T00:00:00Z")).toEqual([partial]);
    const all = await get("viewer", "?count=true");
    expect(all.status).toBe(200);
    expect(all.body.totalCount).toBe(3);
  });

  it("FR-081: cursor paging has no gaps/duplicates on equal created_at; bad cursor → 400", async () => {
    const at = new Date("2026-10-05T00:00:00Z");
    const seeded = await Promise.all([1, 2, 3, 4, 5].map(() => seedJob({ createdAt: at })));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const q: string = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const res = await get("viewer", q);
      expect(res.status).toBe(200);
      seen.push(...(res.body.items as { id: string }[]).map((i) => i.id));
      cursor = res.body.nextCursor as string | null;
    } while (cursor);
    expect([...seen].sort()).toEqual([...seeded].sort());
    expect(new Set(seen).size).toBe(5);
    const bad = await get("viewer", "?cursor=garbage");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-COL-016: detail has full counters, error and providerUsage (no raw headers); other project → 404", async () => {
    const id = await seedJob({
      status: "failed",
      recordsFetched: 10,
      errorCode: "RATE_LIMITED",
      errorMessage: "slow down",
      providerUsage: { remaining: 3, resetAt: null, observedAt: "2026-10-01T00:00:00.000Z", raw: { x: "secret" } },
    });
    const res = await get("viewer", `/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: "failed",
      recordsFetched: 10,
      error: { code: "RATE_LIMITED", message: "slow down" },
      providerUsage: { remaining: 3, resetAt: null, observedAt: "2026-10-01T00:00:00.000Z" },
    });
    expect(res.body.providerUsage).not.toHaveProperty("raw");
    const foreign = await seedJob({ projectId: otherProjectId, queryId: null });
    expect((await get("viewer", `/${foreign}`)).status).toBe(404);
  });

  it("TC-SYS-011: admin retry → 202, new queued retry job resumes from cursor, source untouched, audited", async () => {
    const since = new Date("2026-10-01T00:00:00Z");
    const until = new Date("2026-10-02T00:00:00Z");
    const src = await seedJob({ status: "failed", lastCursor: "cur-42", windowSince: since, windowUntil: until });
    const res = await retry("admin", src);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: expect.any(String), status: "queued" });
    const created = await prisma.syncJob.findUniqueOrThrow({ where: { id: res.body.jobId as string } });
    expect(created).toMatchObject({
      trigger: "retry",
      status: "queued",
      queryId: queryA,
      lastCursor: "cur-42",
      windowSince: since,
      windowUntil: until,
      requestedBy: users.admin.id,
    });
    expect((await prisma.syncJob.findUniqueOrThrow({ where: { id: src } })).status).toBe("failed");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "sync_job.retry_requested" } });
    expect(audit).toMatchObject({ entityType: "sync_job", entityId: created.id });
    expect(audit.metadata).toEqual({ sourceJobId: src, queryId: queryA });

    const again = await retry("admin", src);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("SYNC_ALREADY_RUNNING");
    expect(again.body.error.details).toEqual({ jobId: created.id });
  });

  it.each(["viewer", "analyst"] as const)("TC-SYS-011 / FR-015: %s retry → 403 FORBIDDEN_ROLE", async (who) => {
    const src = await seedJob({ status: "failed" });
    const res = await retry(who, src);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    expect(await prisma.syncJob.count()).toBe(1);
  });

  it("retry of success job / disabled query → 409 SYNC_JOB_NOT_RETRYABLE; foreign job → 404", async () => {
    const ok = await seedJob({ status: "success" });
    expect((await retry("admin", ok)).body.error.code).toBe("SYNC_JOB_NOT_RETRYABLE");
    const failedB = await seedJob({ status: "failed", queryId: queryB });
    await prisma.listeningQuery.update({ where: { id: queryB }, data: { enabled: false } });
    const res = await retry("admin", failedB);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SYNC_JOB_NOT_RETRYABLE");
    const foreign = await seedJob({ projectId: otherProjectId, queryId: null, status: "failed" });
    expect((await retry("admin", foreign)).status).toBe(404);
  });
});
