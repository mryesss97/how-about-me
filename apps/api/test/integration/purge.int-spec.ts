import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { AuditService } from "../../src/modules/audit/audit.service";
import { applyPurge, countPurge, type PurgeScope } from "../../src/modules/retention/purge";
import type { PrismaService } from "../../src/database/prisma.service";
import { createPost, createProject, createQuery, createTestApp, createUser, resetDb } from "../helpers";

/** T-126 (NFR-054, NFR-072): retention purge — dry-run counts equal applied deletes; audit `data.purged`. */
describe("Purge (T-126)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let audit: AuditService;
  const OLD = new Date("2025-06-01T00:00:00Z");
  const NEW = new Date("2025-10-01T00:00:00Z");
  const BEFORE = new Date("2025-09-01T00:00:00Z");

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    audit = app.get(AuditService);
  });
  beforeEach(async () => resetDb(prisma));
  afterAll(async () => app.close());

  /** Post with a match, a completed run + analysis (2 intents, 1 topic) as current, and an override. */
  async function fullPost(projectId: string, queryId: string, reviewer: string, publishedAt: Date) {
    const post = await createPost(prisma, { projectId, queryId, publishedAt });
    const runId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId: post.id,
        projectId,
        status: "completed",
        trigger: "ingest",
        sourceContentHash: post.contentHash,
        sourceRevision: 1,
        effectiveVersion: "v1",
      },
    });
    const analysisId = randomUUID();
    await prisma.postAnalysis.create({
      data: { id: analysisId, analysisRunId: runId, postId: post.id, projectId, relevanceLabel: "relevant" },
    });
    await prisma.analysisIntent.createMany({
      data: [
        { analysisId, label: "question" },
        { analysisId, label: "complaint" },
      ],
    });
    await prisma.analysisTopic.create({ data: { analysisId, label: "price" } });
    // BR-041: phrase rows are purged with their analysis.
    await prisma.analysisPhrase.create({ data: { analysisId, phrase: "giá vé", position: 0 } });
    await prisma.socialPost.update({ where: { id: post.id }, data: { currentAnalysisId: analysisId } });
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        projectId,
        analysisId,
        field: "relevance",
        overrideValue: "irrelevant",
        reviewedBy: reviewer,
      },
    });
    return post;
  }

  async function fixture() {
    const a = await createProject(prisma);
    const b = await createProject(prisma);
    const reviewer = await createUser(prisma);
    const qa = await createQuery(prisma, { projectId: a.id });
    const qb = await createQuery(prisma, { projectId: b.id });
    const oldA = [];
    for (let i = 0; i < 3; i++) oldA.push(await fullPost(a.id, qa.id, reviewer.id, OLD));
    const newA = await fullPost(a.id, qa.id, reviewer.id, NEW);
    const oldB = await fullPost(b.id, qb.id, reviewer.id, OLD);
    return { a, b, oldA, newA, oldB, reviewer };
  }

  const auditRows = () => prisma.auditLog.findMany({ where: { action: "data.purged" }, orderBy: { createdAt: "asc" } });

  it("AC: dry-run counts equal applied deletes per table; other data untouched", async () => {
    const { a, newA, oldB } = await fixture();
    const scope: PurgeScope = { scope: "project", projectId: a.id, before: BEFORE };
    const dry = await countPurge(prisma, scope);
    expect(dry).toEqual({
      posts: 3,
      matches: 3,
      overrides: 3,
      intents: 6,
      topics: 3,
      phrases: 3,
      analyses: 3,
      runs: 3,
    });
    // Dry run deletes nothing and writes no audit.
    expect(await prisma.socialPost.count()).toBe(5);
    expect(await auditRows()).toHaveLength(0);

    const applied = await applyPurge(prisma, audit, scope);
    expect(applied).toEqual(dry);
    const left = await prisma.socialPost.findMany({ select: { id: true } });
    expect(left.map((p) => p.id).sort()).toEqual([newA.id, oldB.id].sort());
    expect(await prisma.analysisIntent.count()).toBe(4);
    expect(await prisma.analysisOverride.count()).toBe(2);

    const rows = await auditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ projectId: a.id, entityType: "social_post", actorUserId: null });
    expect(rows[0]?.metadata).toEqual({ scope: "project", count: 3, counts: dry, before: BEFORE.toISOString() });

    // Idempotent: second run deletes nothing and writes no audit.
    expect(await applyPurge(prisma, audit, scope)).toEqual({ ...dry, ...zeroPosts });
    expect(await auditRows()).toHaveLength(1);
  });

  const zeroPosts = { posts: 0, matches: 0, overrides: 0, intents: 0, topics: 0, phrases: 0, analyses: 0, runs: 0 };

  it("small batch size gives the same totals, one audit row per batch sharing requestId", async () => {
    const { a } = await fixture();
    const scope: PurgeScope = { scope: "project", projectId: a.id, before: BEFORE };
    const dry = await countPurge(prisma, scope);
    const applied = await applyPurge(prisma, audit, scope, { batchSize: 2, requestId: "run-1" });
    expect(applied).toEqual(dry);
    const rows = await auditRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.requestId === "run-1")).toBe(true);
  });

  it("post scope deletes one post and its children; audit entityId + actor", async () => {
    const { oldB, b, reviewer } = await fixture();
    const scope: PurgeScope = { scope: "post", platform: "threads", platformPostId: oldB.platformPostId };
    const dry = await countPurge(prisma, scope);
    expect(dry).toEqual({
      posts: 1,
      matches: 1,
      overrides: 1,
      intents: 2,
      topics: 1,
      phrases: 1,
      analyses: 1,
      runs: 1,
    });
    expect(await applyPurge(prisma, audit, scope, { actorUserId: reviewer.id })).toEqual(dry);
    expect(await prisma.socialPost.count()).toBe(4);
    const [row] = await auditRows();
    expect(row).toMatchObject({ projectId: b.id, entityId: oldB.id, actorUserId: reviewer.id });
    expect(row?.metadata).toMatchObject({ scope: "post", count: 1, platformPostId: oldB.platformPostId });
  });

  it("unknown post → zero counts, no audit", async () => {
    const scope: PurgeScope = { scope: "post", platform: "threads", platformPostId: "nope" };
    expect(await applyPurge(prisma, audit, scope)).toEqual(zeroPosts);
    expect(await auditRows()).toHaveLength(0);
  });

  it("sync-jobs: deletes old terminal jobs, keeps queued/running and recent ones", async () => {
    const a = await createProject(prisma);
    const b = await createProject(prisma);
    const job = (projectId: string, status: "success" | "failed" | "queued" | "running", createdAt: Date) =>
      prisma.syncJob.create({
        data: {
          id: randomUUID(),
          projectId,
          status,
          trigger: "scheduled",
          searchType: "RECENT",
          searchMode: "KEYWORD",
          createdAt,
        },
      });
    await job(a.id, "success", OLD);
    await job(a.id, "failed", OLD);
    await job(a.id, "running", OLD);
    await job(a.id, "queued", OLD);
    await job(a.id, "success", NEW);
    await job(b.id, "success", OLD);

    const scoped: PurgeScope = { scope: "sync-jobs", before: BEFORE, projectId: a.id };
    expect(await countPurge(prisma, scoped)).toEqual({ syncJobs: 2 });
    expect(await applyPurge(prisma, audit, scoped)).toEqual({ syncJobs: 2 });
    expect(await prisma.syncJob.count()).toBe(4);

    const global: PurgeScope = { scope: "sync-jobs", before: BEFORE };
    expect(await countPurge(prisma, global)).toEqual({ syncJobs: 1 });
    expect(await applyPurge(prisma, audit, global)).toEqual({ syncJobs: 1 });
    const statuses = (await prisma.syncJob.findMany({ select: { status: true } })).map((j) => j.status).sort();
    expect(statuses).toEqual(["queued", "running", "success"]);

    const rows = await auditRows();
    expect(rows.map((r) => r.projectId)).toEqual([a.id, null]);
    expect(rows[1]).toMatchObject({ entityType: "sync_job" });
    expect(rows[1]?.metadata).toEqual({
      scope: "sync-jobs",
      count: 1,
      counts: { syncJobs: 1 },
      before: BEFORE.toISOString(),
    });
  });
});
