import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import type { PrismaService } from "../../src/database/prisma.service";
import { RetentionJobService } from "../../src/jobs/retention-job.service";
import { AuditService } from "../../src/modules/audit/audit.service";
import { applyPurge, countPurge, type PurgeScope } from "../../src/modules/retention/purge";
import { createPost, createProject, createQuery, createUser, createTestApp, resetDb } from "../helpers";

const DAY = 86_400_000;
const OLD = new Date("2025-06-01T00:00:00Z");
const NEW = new Date("2025-10-01T00:00:00Z");
const BEFORE = new Date("2025-09-01T00:00:00Z");
const NOW = new Date("2026-10-13T20:00:00Z");
/** NOW − 407 days truncated to UTC midnight = BEFORE. */
const DAYS = 407;

/** T-153 (NFR-054): scheduled retention job and the `runs` history scope. */
describe("Retention job (T-153, NFR-054)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let audit: AuditService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    audit = app.get(AuditService);
  });
  beforeEach(async () => resetDb(prisma));
  afterAll(async () => app.close());

  async function run(
    postId: string,
    projectId: string,
    contentHash: string,
    status: "completed" | "failed" | "pending",
    createdAt: Date,
    withAnalysis = false,
  ) {
    const id = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id,
        postId,
        projectId,
        status,
        trigger: "ingest",
        sourceContentHash: contentHash,
        sourceRevision: 1,
        effectiveVersion: `v-${id.slice(0, 6)}`,
        createdAt,
      },
    });
    if (!withAnalysis) return { runId: id, analysisId: null };
    const analysisId = randomUUID();
    await prisma.postAnalysis.create({
      data: { id: analysisId, analysisRunId: id, postId, projectId, relevanceLabel: "relevant" },
    });
    await prisma.analysisIntent.create({ data: { analysisId, label: "question" } });
    await prisma.analysisTopic.create({ data: { analysisId, label: "price" } });
    await prisma.analysisPhrase.create({ data: { analysisId, phrase: "giá vé", position: 0 } });
    return { runId: id, analysisId };
  }

  /** Recent post with history: only r1 is purgeable (old, terminal, not current, no override, has newer run). */
  async function history(projectId: string) {
    const reviewer = await createUser(prisma);
    const post = await createPost(prisma, { projectId, publishedAt: NEW });
    const h = post.contentHash;
    const r1 = await run(post.id, projectId, h, "completed", new Date(OLD.getTime() - 4 * DAY), true);
    const r2 = await run(post.id, projectId, h, "completed", new Date(OLD.getTime() - 3 * DAY), true);
    const r3 = await run(post.id, projectId, h, "pending", new Date(OLD.getTime() - 2 * DAY));
    const r4 = await run(post.id, projectId, h, "completed", new Date(OLD.getTime() - DAY), true);
    const r5 = await run(post.id, projectId, h, "failed", NEW);
    await prisma.socialPost.update({ where: { id: post.id }, data: { currentAnalysisId: r4.analysisId } });
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        projectId,
        analysisId: r2.analysisId,
        field: "relevance",
        overrideValue: "irrelevant",
        reviewedBy: reviewer.id,
      },
    });
    // Another post whose only run is old, terminal and non-current: kept as the latest run.
    const lone = await createPost(prisma, { projectId, publishedAt: NEW });
    const r6 = await run(lone.id, projectId, lone.contentHash, "failed", OLD);
    return { post, r1, r2, r3, r4, r5, r6 };
  }

  const auditRows = () => prisma.auditLog.findMany({ where: { action: "data.purged" }, orderBy: { createdAt: "asc" } });

  it("runs scope deletes only eligible non-current history; dry-run equals apply; idempotent", async () => {
    const p = await createProject(prisma);
    const h = await history(p.id);
    const scope: PurgeScope = { scope: "runs", projectId: p.id, before: BEFORE };
    const dry = await countPurge(prisma, scope);
    expect(dry).toEqual({ runs: 1, analyses: 1, intents: 1, topics: 1, phrases: 1 });
    expect(await applyPurge(prisma, audit, scope, { requestId: "r-1" })).toEqual(dry);
    const left = (await prisma.analysisRun.findMany({ select: { id: true } })).map((r) => r.id).sort();
    expect(left).toEqual([h.r2.runId, h.r3.runId, h.r4.runId, h.r5.runId, h.r6.runId].sort());
    const [row] = await auditRows();
    expect(row).toMatchObject({ projectId: p.id, entityType: "analysis_run", actorUserId: null, requestId: "r-1" });
    expect(row?.metadata).toEqual({ scope: "runs", count: 1, counts: dry, before: BEFORE.toISOString() });
    expect(await applyPurge(prisma, audit, scope)).toEqual({ runs: 0, analyses: 0, intents: 0, topics: 0, phrases: 0 });
    expect(await auditRows()).toHaveLength(1);
  });

  function job(mode: AppConfig["RETENTION_JOB_MODE"]) {
    const cfg = {
      ...app.get<AppConfig>(APP_CONFIG),
      RETENTION_JOB_MODE: mode,
      RETENTION_POSTS_DAYS: DAYS,
      RETENTION_RUNS_DAYS: DAYS,
      RETENTION_SYNC_JOBS_DAYS: DAYS,
    };
    const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return new RetentionJobService(cfg, prisma, audit, app.get(SchedulerRegistry), logger as unknown as PinoLogger);
  }

  async function seed() {
    const a = await createProject(prisma);
    const b = await createProject(prisma);
    const q = await createQuery(prisma, { projectId: a.id });
    const oldPost = await createPost(prisma, { projectId: a.id, queryId: q.id, publishedAt: OLD });
    const newPost = await createPost(prisma, { projectId: b.id, publishedAt: NEW });
    const h = await history(b.id);
    const sync = (status: "success" | "running", createdAt: Date) =>
      prisma.syncJob.create({
        data: {
          id: randomUUID(),
          projectId: a.id,
          status,
          trigger: "scheduled",
          searchType: "RECENT",
          searchMode: "KEYWORD",
          createdAt,
        },
      });
    await sync("success", OLD);
    await sync("running", OLD);
    await sync("success", NEW);
    return { a, b, oldPost, newPost, h };
  }

  it("dry-run mode deletes nothing and writes no audit", async () => {
    await seed();
    const posts = await prisma.socialPost.count();
    await job("dry-run").run(NOW);
    expect(await prisma.socialPost.count()).toBe(posts);
    expect(await prisma.analysisRun.count()).toBe(6);
    expect(await prisma.syncJob.count()).toBe(3);
    expect(await auditRows()).toHaveLength(0);
  });

  it("apply mode deletes old posts, eligible runs and old terminal sync jobs; one requestId; re-run is a no-op", async () => {
    const { oldPost, h } = await seed();
    await job("apply").run(NOW);
    expect(await prisma.socialPost.findUnique({ where: { id: oldPost.id } })).toBeNull();
    expect(await prisma.analysisRun.findUnique({ where: { id: h.r1.runId } })).toBeNull();
    expect(await prisma.analysisRun.count()).toBe(5);
    const statuses = (await prisma.syncJob.findMany({ select: { status: true } })).map((j) => j.status).sort();
    expect(statuses).toEqual(["running", "success"]);
    const rows = await auditRows();
    expect(rows.map((r) => r.entityType).sort()).toEqual(["analysis_run", "social_post", "sync_job"]);
    expect(new Set(rows.map((r) => r.requestId)).size).toBe(1);
    expect(rows.every((r) => r.actorUserId === null)).toBe(true);

    await job("apply").run(NOW);
    expect(await auditRows()).toHaveLength(3);
  });
});
