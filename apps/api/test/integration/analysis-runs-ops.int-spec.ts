import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AnalysisRunsPageSchema } from "@how-about-me/contracts";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { AnalysisPauseService } from "../../src/modules/analysis/analysis-pause.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { createPost } from "../helpers/factories";

/** T-077: analysis runs ops (list, retry, retry-failed) + system-status analysis — FR-175, FR-171, TC-SYS-004/012. */
describe("Analysis runs ops (T-077)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let otherProjectId: string;
  type Who = "admin" | "analyst" | "viewer";
  const users = {} as { [K in Who]: { id: string; token: string } };
  const http = () => request(app.getHttpServer());
  const base = (pid = projectId) => `/api/v1/projects/${pid}/analysis-runs`;
  const auth = (who: Who) => `Bearer ${users[who].token}`;
  const list = (who: Who, q = "") => http().get(`${base()}${q}`).set("authorization", auth(who));
  const retry = (who: Who, id: string) => http().post(`${base()}/${id}/retry`).set("authorization", auth(who));
  const retryFailed = (who: Who, body: object = {}) =>
    http().post(`${base()}/retry-failed`).set("authorization", auth(who)).send(body);

  async function seedPost(pid = projectId): Promise<string> {
    return (await createPost(prisma, { projectId: pid })).id;
  }

  async function seedRun(postId: string, data: Partial<Prisma.AnalysisRunUncheckedCreateInput> = {}): Promise<string> {
    const id = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id,
        postId,
        projectId,
        status: "failed",
        trigger: "ingest",
        sourceContentHash: `h-${id}`,
        sourceRevision: 1,
        effectiveVersion: "v",
        attemptCount: 3,
        errorCode: "ANALYSIS_PROVIDER_ERROR",
        errorMessage: "boom",
        completedAt: new Date(),
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
    app.get(AnalysisPauseService).invalidate();
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
  });
  afterAll(async () => app.close());

  it("FR-175: list filters by status and from/to, pages by cursor, hides other projects", async () => {
    const p = await seedPost();
    const a = await seedRun(p, { createdAt: new Date("2026-10-01T00:00:00Z") });
    const b = await seedRun(p, { status: "completed", createdAt: new Date("2026-10-02T00:00:00Z") });
    const c = await seedRun(p, { status: "stale", createdAt: new Date("2026-10-03T00:00:00Z") });
    await seedRun(await seedPost(otherProjectId), { projectId: otherProjectId });

    const ids = async (q: string) => ((await list("viewer", q)).body.items as { id: string }[]).map((i) => i.id);
    expect(await ids("")).toEqual([c, b, a]);
    expect(await ids("?status=failed")).toEqual([a]);
    expect(await ids("?status=failed,completed")).toEqual([b, a]);
    expect(await ids("?from=2026-10-02T00:00:00Z&to=2026-10-03T00:00:00Z")).toEqual([b]);

    const p1 = await list("viewer", "?limit=2&count=true");
    expect(p1.status).toBe(200);
    expect(p1.body.totalCount).toBe(3);
    expect(p1.body.items[0]).toMatchObject({ id: c, status: "stale", postId: p, attemptCount: 3 });
    const p2 = await list("viewer", `?limit=2&cursor=${encodeURIComponent(p1.body.nextCursor as string)}`);
    expect((p2.body.items as { id: string }[]).map((i) => i.id)).toEqual([a]);
    expect(p2.body.nextCursor).toBeNull();
    expect((await list("viewer", "?status=bogus")).status).toBe(400);
  });

  it("#343: list items carry the post excerpt (≤ 80 code points) and username; media-only → null", async () => {
    const long = (await createPost(prisma, { projectId, text: `  ${"x".repeat(90)}\n `, username: "an.nguyen" })).id;
    const media = await seedPost();
    await prisma.socialPost.update({ where: { id: media }, data: { text: null, username: null } });
    const a = await seedRun(long, { createdAt: new Date("2026-10-01T00:00:00Z") });
    const b = await seedRun(media, { createdAt: new Date("2026-10-02T00:00:00Z") });

    const res = await list("viewer", "?status=failed");
    expect(res.status).toBe(200);
    expect(AnalysisRunsPageSchema.safeParse(res.body).success).toBe(true);
    const byId = new Map((res.body.items as { id: string; post: unknown }[]).map((i) => [i.id, i.post]));
    expect(byId.get(a)).toEqual({ excerpt: `${"x".repeat(80)}…`, username: "an.nguyen" });
    expect(byId.get(b)).toEqual({ excerpt: null, username: null });
  });

  it("TC-SYS-012: retry moves failed → pending in place, resets attempts, writes audit", async () => {
    const p = await seedPost();
    const id = await seedRun(p);
    const res = await retry("admin", id);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ runId: id, status: "pending" });
    const row = await prisma.analysisRun.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "pending", attemptCount: 0, errorCode: null, completedAt: null });
    const audit = await prisma.auditLog.findMany({ where: { action: "analysis.retry_requested" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ entityType: "analysis_run", entityId: id, metadata: { postIds: [p] } });
  });

  it("FR-175: retry errors — not failed 409, other project 404, open run 409 (BR-024), non-admin 403", async () => {
    const p = await seedPost();
    const done = await seedRun(p, { status: "completed" });
    expect((await retry("admin", done)).body.error.code).toBe("ANALYSIS_RUN_NOT_RETRYABLE");

    const otherPost = await seedPost(otherProjectId);
    const foreign = await seedRun(otherPost, { projectId: otherProjectId });
    expect((await retry("admin", foreign)).status).toBe(404);

    const failed = await seedRun(p);
    await seedRun(p, { status: "pending", completedAt: null });
    const r = await retry("admin", failed);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("ANALYSIS_ALREADY_PENDING");

    for (const who of ["analyst", "viewer"] as const) {
      const f = await retry(who, failed);
      expect(f.status).toBe(403);
      expect(f.body.error.code).toBe("FORBIDDEN_ROLE");
    }
  });

  it("FR-175 / BR-024: retry-failed honours limit, one run per post, skips posts with open runs, one audit", async () => {
    const p1 = await seedPost();
    const p1Old = await seedRun(p1, { createdAt: new Date("2026-10-01T00:00:00Z") });
    const p1New = await seedRun(p1, { createdAt: new Date("2026-10-02T00:00:00Z") });
    const p2 = await seedPost();
    await seedRun(p2);
    await seedRun(p2, { status: "processing", completedAt: null });
    const p3 = await seedPost();
    const p3Run = await seedRun(p3, { createdAt: new Date("2026-09-01T00:00:00Z") });

    expect((await retryFailed("admin", { limit: 501 })).status).toBe(400);
    expect((await retryFailed("analyst")).status).toBe(403);

    const r1 = await retryFailed("admin", { limit: 1 });
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ enqueued: 1 });
    const status = async (id: string) => (await prisma.analysisRun.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(p1New)).toBe("pending");
    expect(await status(p1Old)).toBe("failed");
    expect(await status(p3Run)).toBe("failed");

    const r2 = await retryFailed("admin");
    expect(r2.body).toEqual({ enqueued: 1 });
    expect(await status(p3Run)).toBe("pending");
    expect(await status(p1Old)).toBe("failed");

    const audit = await prisma.auditLog.findMany({
      where: { action: "analysis.retry_requested" },
      orderBy: { createdAt: "asc" },
    });
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({
      entityType: "monitoring_project",
      entityId: projectId,
      metadata: { scope: "failed", counts: { enqueued: 1, limit: 1 } },
    });
  });

  it("TC-SYS-004 / FR-171: system-status analysis block from seeded runs; runs older than 24h excluded", async () => {
    const now = Date.now();
    const p = await seedPost();
    await seedRun(p, { status: "pending", completedAt: null, createdAt: new Date(now - 600_000) });
    await seedRun(await seedPost(), { status: "processing", completedAt: null });
    await seedRun(await seedPost(), { completedAt: new Date(now - 3_600_000) });
    await seedRun(await seedPost(), { completedAt: new Date(now - 2 * 86_400_000) });
    for (let i = 0; i < 9; i++)
      await seedRun(await seedPost(), {
        status: "completed",
        errorCode: null,
        inputTokens: 100,
        outputTokens: 10,
        estimatedCostUsd: "0.001",
      });
    await seedRun(await seedPost(otherProjectId), { projectId: otherProjectId, status: "pending", completedAt: null });

    const res = await http().get(`/api/v1/projects/${projectId}/system-status`).set("authorization", auth("viewer"));
    expect(res.status).toBe(200);
    expect(res.body.analysis).toMatchObject({
      status: "healthy",
      pending: 1,
      processing: 1,
      failed24h: 1,
      completed24h: 9,
      tokens24h: { input: 900, output: 90 },
    });
    expect(res.body.analysis.estimatedCost24hUsd).toBeCloseTo(0.009, 6);
    expect(res.body.analysis.analysisLagSeconds).toBeGreaterThanOrEqual(599);
  });
});
