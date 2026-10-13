import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { APP_CONFIG } from "../../src/config/config.module";
import { loadEnv } from "../../src/config/env.schema";
import { AnalysisService } from "../../src/modules/analysis/analysis.service";
import { api, createActor, createPost, createProject, createQuery, createTestApp, resetDb } from "../helpers";

/**
 * T-145 bulk re-analysis + mark-stale by version against real Postgres — FR-196, NFR-017, FR-015, FR-100,
 * BR-002, BR-003, BR-016, BR-023, BR-024; TC-REV-008, TC-REV-009.
 */
const CAP = 3;
const WEEK = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" };
const ACTION = "analysis.bulk_reanalyze_requested";

describe("Bulk re-analysis + mark-stale (T-145)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let current: string;
  let projectId: string;
  let otherProjectId: string;
  let queryId: string;
  let admin: string;
  let seq = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(APP_CONFIG).useFactory({ factory: () => ({ ...loadEnv(), ANALYSIS_BULK_MAX: CAP }) }),
    }));
    // No analysis_settings row → v1 default policy (FR-190).
    current = app.get(AnalysisService).effectiveVersionOf("safety-policy-v1");
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    seq = 0;
    projectId = (await createProject(prisma)).id;
    otherProjectId = (await createProject(prisma)).id;
    queryId = (await createQuery(prisma, { projectId })).id;
    admin = (await createActor(prisma, { projectId, role: "admin" })).token;
  });

  /** Post matched by a query, with a completed run of `version` and labels (relevant by default). */
  async function seed(
    opts: {
      version?: string;
      relevance?: "relevant" | "irrelevant";
      open?: "pending" | "processing";
      pid?: string;
    } = {},
  ) {
    const pid = opts.pid ?? projectId;
    seq += 1;
    const at = new Date(`2026-10-02T00:00:${String(seq).padStart(2, "0")}Z`);
    const post = await createPost(prisma, { projectId: pid, publishedAt: at, firstSeenAt: at, text: `post ${seq}` });
    const qid = pid === projectId ? queryId : (await createQuery(prisma, { projectId: pid })).id;
    await prisma.postQueryMatch.create({
      data: { postId: post.id, queryId: qid, excludedByTerms: false, firstMatchedAt: at, lastMatchedAt: at },
    });
    const runId = randomUUID();
    const analysisId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId: post.id,
        projectId: pid,
        status: "completed",
        trigger: "ingest",
        sourceContentHash: post.contentHash,
        sourceRevision: 1,
        effectiveVersion: opts.version ?? "old-version",
        completedAt: at,
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId: pid,
        relevanceLabel: opts.relevance ?? "relevant",
        relevanceConfidence: 0.9,
        sentimentLabel: "neutral",
        safetyLevel: "safe",
        languageCode: "vi",
        overallModelConfidence: 0.9,
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    if (opts.open) {
      await prisma.analysisRun.create({
        data: {
          id: randomUUID(),
          postId: post.id,
          projectId: pid,
          status: opts.open,
          trigger: "ingest",
          sourceContentHash: post.contentHash,
          sourceRevision: 1,
          effectiveVersion: "some-other",
        },
      });
    }
    return { postId: post.id, runId };
  }

  const bulk = (body: object, token = admin) =>
    api(app, token).post(`/projects/${projectId}/mentions/reanalyze`, { ...WEEK, ...body });
  const markStale = (query: string, token = admin) =>
    api(app, token).post(`/projects/${projectId}/analysis-runs/mark-stale?${query}`);
  const bulkRuns = (trigger: "bulk" | "version_change" = "bulk") => prisma.analysisRun.findMany({ where: { trigger } });

  it("TC-REV-008 / FR-196: dryRun → matched == list totalCount, nothing enqueued, no audit, no throttle", async () => {
    for (let i = 0; i < 4; i++) await seed();
    const before = await prisma.analysisRun.count();
    const res = await bulk({ dryRun: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matched: 4, enqueued: 0, cap: CAP });
    const list = await api(app, admin).get(
      `/projects/${projectId}/mentions?${new URLSearchParams({ ...WEEK, count: "true" }).toString()}`,
    );
    expect(list.body.totalCount).toBe(4);
    expect(await prisma.analysisRun.count()).toBe(before);
    expect(await prisma.auditLog.count({ where: { action: ACTION } })).toBe(0);
    // The preview matches the real call on the same filters (dryRun did not consume the throttle).
    const real = await bulk({});
    expect(real.status).toBe(200);
    expect(real.body).toEqual({ matched: 4, enqueued: Math.min(4, CAP), cap: CAP });
  });

  it("TC-REV-009 / NFR-017 / BR-003: cap enforced (newest first), second call → 429 + Retry-After, one audit", async () => {
    const posts = [];
    for (let i = 0; i < 5; i++) posts.push(await seed());
    const res = await bulk({ sort: "newest" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matched: 5, enqueued: CAP, cap: CAP });
    const runs = await bulkRuns();
    expect(runs).toHaveLength(CAP);
    expect(runs.every((r) => r.status === "pending" && r.effectiveVersion === current)).toBe(true);
    const newest = posts.slice(-CAP).map((p) => p.postId);
    expect(runs.map((r) => r.postId).sort()).toEqual([...newest].sort());
    for (const id of newest) {
      expect((await prisma.socialPost.findUniqueOrThrow({ where: { id } })).latestRunStatus).toBe("pending");
    }
    // BR-003: old runs kept.
    expect(await prisma.analysisRun.count({ where: { status: "completed" } })).toBe(5);

    const again = await bulk({});
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe("RATE_LIMITED");
    const retry = Number(again.headers["retry-after"]);
    expect(retry).toBeGreaterThan(0);
    expect(retry).toBeLessThanOrEqual(300);
    expect(again.body.error.details.retryAfterSeconds).toBe(retry);

    const logs = await prisma.auditLog.findMany({ where: { action: ACTION } });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.metadata).toMatchObject({
      scope: "filters",
      counts: { matched: 5, enqueued: CAP, cap: CAP },
      effectiveVersion: current,
      filters: { sort: "newest" },
    });
    // Window elapsed → allowed again.
    await prisma.auditLog.updateMany({
      where: { action: ACTION },
      data: { createdAt: new Date(Date.now() - 301_000) },
    });
    expect((await bulk({})).status).toBe(200);
  });

  it("BR-024 / FR-116: skips posts already completed for the current version or with any open run", async () => {
    const done = await seed({ version: current });
    const open = await seed({ open: "processing" });
    const eligible = await seed();
    const res = await bulk({});
    expect(res.body).toEqual({ matched: 3, enqueued: 1, cap: CAP });
    expect((await bulkRuns()).map((r) => r.postId)).toEqual([eligible.postId]);
    expect(
      await prisma.analysisRun.count({ where: { postId: { in: [done.postId, open.postId] }, trigger: "bulk" } }),
    ).toBe(0);
  });

  it("BR-016: irrelevant excluded by default; relevance=[irrelevant] targets them", async () => {
    await seed({ relevance: "irrelevant" });
    await seed();
    expect((await bulk({ dryRun: true })).body.matched).toBe(1);
    expect((await bulk({ dryRun: true, relevance: ["irrelevant"] })).body.matched).toBe(1);
  });

  it("Q5: real call with enqueued=0 still audits and consumes the throttle", async () => {
    await seed({ version: current });
    expect((await bulk({})).body).toEqual({ matched: 1, enqueued: 0, cap: CAP });
    expect(await prisma.auditLog.count({ where: { action: ACTION } })).toBe(1);
    expect((await bulk({})).status).toBe(429);
  });

  it("NFR-017: concurrent real calls → one 200, one 429, one audit row", async () => {
    await seed();
    const results = await Promise.all([bulk({}), bulk({})]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
    expect(await prisma.auditLog.count({ where: { action: ACTION } })).toBe(1);
  });

  it("FR-015: analyst (even with allowAnalystReanalyze) and viewer → 403; other project's admin → 403", async () => {
    const other = await seed({ pid: otherProjectId });
    const analyst = (await createActor(prisma, { projectId, role: "analyst" })).token;
    await prisma.monitoringProject.update({
      where: { id: projectId },
      data: { settings: { allowAnalystReanalyze: true } },
    });
    const viewer = (await createActor(prisma, { projectId, role: "viewer" })).token;
    const outsider = (await createActor(prisma, { projectId: otherProjectId, role: "admin" })).token;
    for (const t of [analyst, viewer]) {
      const r = await bulk({}, t);
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe("FORBIDDEN_ROLE");
      expect((await markStale("version=old-version", t)).status).toBe(403);
    }
    expect((await bulk({}, outsider)).status).toBe(403);
    await bulk({});
    expect(await prisma.analysisRun.count({ where: { postId: other.postId, trigger: "bulk" } })).toBe(0);
  });

  it("validation: bad range / unknown label → 400", async () => {
    expect((await bulk({ to: WEEK.from })).status).toBe(400);
    expect((await bulk({ sentiment: ["bogus"] })).status).toBe(400);
  });

  it("BR-023 / FR-100: mark-stale stales old-version runs in project, re-enqueues ≤ cap, skips irrelevant", async () => {
    const posts = [];
    for (let i = 0; i < 4; i++) posts.push(await seed());
    const irrelevant = await seed({ relevance: "irrelevant" });
    const keep = await seed({ version: current });
    const foreign = await seed({ pid: otherProjectId });

    const dry = await markStale("version=old-version&dryRun=true");
    expect(dry.body).toEqual({ marked: 5, enqueued: 0, cap: CAP });
    expect(await prisma.analysisRun.count({ where: { status: "stale" } })).toBe(0);

    const res = await markStale("version=old-version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ marked: 5, enqueued: CAP, cap: CAP });
    expect(await prisma.analysisRun.count({ where: { status: "stale" } })).toBe(5);
    expect((await prisma.analysisRun.findUniqueOrThrow({ where: { id: keep.runId } })).status).toBe("completed");
    expect((await prisma.analysisRun.findUniqueOrThrow({ where: { id: foreign.runId } })).status).toBe("completed");
    const runs = await bulkRuns("version_change");
    expect(runs).toHaveLength(CAP);
    expect(runs.every((r) => r.effectiveVersion === current)).toBe(true);
    expect(runs.map((r) => r.postId)).not.toContain(irrelevant.postId);
    expect(runs.map((r) => r.postId).sort()).toEqual(
      posts
        .slice(-CAP)
        .map((p) => p.postId)
        .sort(),
    );
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: ACTION } });
    expect(log.metadata).toMatchObject({ scope: "version_change", filters: { version: "old-version" } });

    // Shared throttle with bulk re-analyze.
    expect((await bulk({})).status).toBe(429);
  });

  it("BR-023: mark-stale of the current version → 400, nothing changed", async () => {
    await seed({ version: current });
    const res = await markStale(`version=${encodeURIComponent(current)}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.analysisRun.count({ where: { status: "stale" } })).toBe(0);
    expect((await markStale("")).status).toBe(400);
  });
});
