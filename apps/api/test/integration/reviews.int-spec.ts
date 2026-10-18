import { randomUUID } from "node:crypto";
import {
  MarkReviewedResponseSchema,
  MentionDetailSchema,
  MentionsPageSchema,
  ReviewQueuePageSchema,
} from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { encodeSortCursor } from "../../src/common/pagination/cursor";
import { api, createActor, createPost, createProject, createQuery, createTestApp, resetDb } from "../helpers";

type Seed = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  relevanceConfidence?: number;
  sentimentConfidence?: number;
  /** Latest run status; "failed" adds a failed run after the completed one. */
  status?: "completed" | "failed";
  analysed?: boolean;
  policy?: string;
  excluded?: boolean;
  project?: { projectId: string; queryId: string };
  publishedAt?: Date;
};

/**
 * T-144 review queue — FR-195, BR-007, BR-016, BR-021, BR-025, BR-040, FR-015, FR-200;
 * TC-REV-007 (automated part).
 */
describe("Review queue (T-144)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let queryId: string;
  let analyst: { token: string; userId: string };
  let viewer: string;
  const AT = new Date("2026-10-06T03:00:00Z");
  const base = () => `/projects/${projectId}`;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    projectId = (await createProject(prisma)).id;
    queryId = (await createQuery(prisma, { projectId })).id;
    const a = await createActor(prisma, { projectId, role: "analyst" });
    analyst = { token: a.token, userId: a.user.id };
    viewer = (await createActor(prisma, { projectId, role: "viewer" })).token;
  });

  async function addRun(
    postId: string,
    pid: string,
    status: "completed" | "failed",
    policy?: string,
    createdAt?: Date,
  ) {
    const p = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
    const run = await prisma.analysisRun.create({
      data: {
        id: randomUUID(),
        postId,
        projectId: pid,
        status,
        trigger: "ingest",
        sourceContentHash: p.contentHash,
        sourceRevision: 1,
        effectiveVersion: `test-${randomUUID()}`,
        safetyPolicyVersion: policy ?? null,
        errorCode: status === "failed" ? "PROVIDER_TIMEOUT" : null,
        completedAt: new Date(),
        ...(createdAt ? { createdAt } : {}),
      },
    });
    await prisma.socialPost.update({ where: { id: postId }, data: { latestRunStatus: status } });
    return run.id;
  }

  async function seed(s: Seed = {}): Promise<string> {
    const pid = s.project?.projectId ?? projectId;
    const qid = s.project?.queryId ?? queryId;
    const at = s.publishedAt ?? AT;
    const post = await createPost(prisma, { projectId: pid, queryId: qid, publishedAt: at, firstSeenAt: at });
    if (s.excluded)
      await prisma.postQueryMatch.updateMany({ where: { postId: post.id }, data: { excludedByTerms: true } });
    if (s.analysed !== false) {
      const runId = await addRun(post.id, pid, "completed", s.policy);
      const rc = s.relevanceConfidence ?? 0.9;
      const sc = s.sentimentConfidence ?? 0.9;
      const analysisId = randomUUID();
      await prisma.postAnalysis.create({
        data: {
          id: analysisId,
          analysisRunId: runId,
          postId: post.id,
          projectId: pid,
          relevanceLabel: s.relevance ?? "relevant",
          relevanceConfidence: rc,
          sentimentLabel: "neutral",
          sentimentConfidence: sc,
          overallModelConfidence: Math.min(rc, sc),
          safetyLevel: "safe",
          languageCode: "vi",
        },
      });
      await prisma.socialPost.update({ where: { id: post.id }, data: { currentAnalysisId: analysisId } });
    }
    if (s.status === "failed") await addRun(post.id, pid, "failed");
    return post.id;
  }

  async function queue(extra = "", token = viewer) {
    const res = await api(app, token).get(`${base()}/reviews?${extra}`);
    expect(res.status).toBe(200);
    return ReviewQueuePageSchema.parse(res.body);
  }
  const mark = (postIds: string[], token = analyst.token) =>
    api(app, token).post(`${base()}/reviews/mark-reviewed`, { postIds });

  async function seedStandard() {
    const other = await createProject(prisma);
    const otherQ = await createQuery(prisma, { projectId: other.id });
    return {
      uncertain: await seed({ relevance: "uncertain", publishedAt: new Date("2026-10-06T05:00:00Z") }),
      low: await seed({ sentimentConfidence: 0.5, publishedAt: new Date("2026-10-06T04:00:00Z") }),
      failed: await seed({ status: "failed", publishedAt: new Date("2026-10-06T03:00:00Z") }),
      high: await seed(),
      irrelevantLow: await seed({ relevance: "irrelevant", relevanceConfidence: 0.3 }),
      excluded: await seed({ relevance: "uncertain", excluded: true }),
      otherProject: await seed({ relevance: "uncertain", project: { projectId: other.id, queryId: otherQ.id } }),
    };
  }

  it("FR-195 / BR-007 / BR-016: default list = uncertain, low-confidence, failed with reasons; project isolated", async () => {
    const s = await seedStandard();
    const page = await queue();
    expect(page.items.map((i) => [i.id, i.reasons])).toEqual([
      [s.uncertain, ["uncertain"]],
      [s.low, ["low_confidence"]],
      [s.failed, ["failed"]],
    ]);
    const failed = page.items[2];
    expect(failed?.analysis).toMatchObject({ status: "failed", errorCode: "PROVIDER_TIMEOUT" });
    expect(page.items[1]?.analysis).toMatchObject({ overallConfidence: 0.5, confidenceBand: "low", errorCode: null });
  });

  it("reason filter and count=true counts", async () => {
    const s = await seedStandard();
    expect((await queue("reason=failed")).items.map((i) => i.id)).toEqual([s.failed]);
    expect((await queue("reason=uncertain")).items.map((i) => i.id)).toEqual([s.uncertain]);
    expect((await queue("reason=low_confidence")).items.map((i) => i.id)).toEqual([s.low]);
    const c = await queue("count=true&reason=failed");
    expect(c.counts).toEqual({ all: 3, uncertain: 1, lowConfidence: 1, failed: 1 });
    expect(c.totalCount).toBe(1);
  });

  it("BR-021: low_confidence uses the bands of the run's policy", async () => {
    await prisma.analysisSetting.create({
      data: {
        id: randomUUID(),
        projectId,
        version: 2,
        policyVersion: "safety-policy-v2",
        confidenceBands: { high: 0.85, medium: 0.7 },
        safetyThresholds: {},
      },
    });
    const v2 = await seed({ sentimentConfidence: 0.65, policy: "safety-policy-v2" });
    await seed({ sentimentConfidence: 0.65, policy: "safety-policy-v1" });
    const page = await queue();
    expect(page.items.map((i) => i.id)).toEqual([v2]);
    expect(page.items[0]?.analysis.confidenceBand).toBe("low");
  });

  it("BR-025: override relevance → relevant leaves the uncertain tab; → irrelevant leaves the queue", async () => {
    const a = await seed({ relevance: "uncertain" });
    const b = await seed({ relevance: "uncertain", sentimentConfidence: 0.5 });
    const ov = (mid: string, value: string) =>
      api(app, analyst.token).post(`${base()}/mentions/${mid}/overrides`, { field: "relevance", value });
    expect((await ov(a, "relevant")).status).toBe(201);
    expect((await ov(b, "irrelevant")).status).toBe(201);
    expect((await queue("reason=uncertain")).items).toHaveLength(0);
    expect((await queue()).items).toHaveLength(0);
  });

  it("TC-REV-007 / FR-200: mark reviewed removes from default queue, shows under status=reviewed, audited", async () => {
    const s = await seedStandard();
    const res = await mark([s.failed, s.otherProject]);
    expect(res.status).toBe(200);
    expect(MarkReviewedResponseSchema.parse(res.body)).toEqual({ marked: 1 });
    expect((await queue()).items.map((i) => i.id)).not.toContain(s.failed);
    const reviewed = await queue("status=reviewed");
    expect(reviewed.items.map((i) => i.id)).toEqual([s.failed]);
    expect(reviewed.items[0]?.reviewedBy?.id).toBe(analyst.userId);
    expect(reviewed.items[0]?.reviewedAt).not.toBeNull();
    const other = await prisma.socialPost.findUniqueOrThrow({ where: { id: s.otherProject } });
    expect(other.reviewedAt).toBeNull();
    const audit = await prisma.auditLog.findMany({ where: { action: "review.marked" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.metadata).toEqual({ count: 1, postIds: [s.failed] });
    // Nothing of this project → 0, no audit.
    expect((await mark([s.otherProject])).body).toEqual({ marked: 0 });
    expect(await prisma.auditLog.count({ where: { action: "review.marked" } })).toBe(1);
  });

  it("BR-040: a run created after the review re-opens the item; mentions reviewStatus follows", async () => {
    const id = await seed({ status: "failed" });
    expect((await mark([id])).status).toBe(200);
    const mentions = async (rs: string) => {
      const r = await api(app, viewer).get(
        `${base()}/mentions?from=2026-10-05T00:00:00Z&to=2026-10-12T00:00:00Z&relevance=relevant&reviewStatus=${rs}`,
      );
      expect(r.status).toBe(200);
      return MentionsPageSchema.parse(r.body).items.map((i) => i.id);
    };
    expect(await mentions("reviewed")).toEqual([id]);
    expect(await mentions("unreviewed")).toEqual([]);
    expect(await mentions("reviewed,unreviewed")).toEqual([id]);
    expect((await queue()).items).toHaveLength(0);
    // A run strictly after the review (explicit time: Node and DB clocks may drift, #189).
    const { reviewedAt } = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
    expect(reviewedAt).not.toBeNull();
    await addRun(id, projectId, "failed", undefined, new Date((reviewedAt ?? new Date()).getTime() + 1000));
    expect((await queue()).items.map((i) => i.id)).toEqual([id]);
    expect(await mentions("unreviewed")).toEqual([id]);
  });

  it("#339 / FR-195 / BR-040 / BR-016: mention detail exposes the review state", async () => {
    const s = await seedStandard();
    const detail = async (id: string) => {
      const r = await api(app, viewer).get(`${base()}/mentions/${id}`);
      expect(r.status).toBe(200);
      return MentionDetailSchema.parse(r.body).review;
    };
    expect(await detail(s.uncertain)).toEqual({ reasons: ["uncertain"], status: "unreviewed", reviewedAt: null });
    expect(await detail(s.high)).toBeNull();
    expect(await detail(s.irrelevantLow)).toBeNull();
    expect(await detail(s.excluded)).toBeNull();
    // Other project → 404, no review state leaks.
    expect((await api(app, viewer).get(`${base()}/mentions/${s.otherProject}`)).status).toBe(404);
    // Mark → reviewed; a later run re-opens it (BR-040).
    expect((await mark([s.failed])).status).toBe(200);
    const reviewed = await detail(s.failed);
    expect(reviewed).toMatchObject({ reasons: ["failed"], status: "reviewed" });
    expect(reviewed?.reviewedAt).not.toBeNull();
    const { reviewedAt } = await prisma.socialPost.findUniqueOrThrow({ where: { id: s.failed } });
    await addRun(s.failed, projectId, "failed", undefined, new Date((reviewedAt ?? new Date()).getTime() + 1000));
    expect(await detail(s.failed)).toMatchObject({ status: "unreviewed" });
    // Override → irrelevant leaves the scope (BR-025, BR-016).
    const ov = await api(app, analyst.token).post(`${base()}/mentions/${s.uncertain}/overrides`, {
      field: "relevance",
      value: "irrelevant",
    });
    expect(ov.status).toBe(201);
    expect(await detail(s.uncertain)).toBeNull();
  });

  it("FR-015: viewer can list but not mark; non-member is forbidden", async () => {
    const id = await seed({ status: "failed" });
    const v = await mark([id], viewer);
    expect(v.status).toBe(403);
    expect(v.body.error.code).toBe("FORBIDDEN_ROLE");
    expect((await queue()).items).toHaveLength(1);
    const outsider = (await createActor(prisma)).token;
    const r = await api(app, outsider).get(`${base()}/reviews`);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("FORBIDDEN_PROJECT");
  });

  it("validation: empty / 51 ids / bad query → 400", async () => {
    expect((await mark([])).status).toBe(400);
    expect((await mark(Array.from({ length: 51 }, () => randomUUID()))).status).toBe(400);
    const r = await api(app, viewer).get(`${base()}/reviews?reason=irrelevant`);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keyset pagination: 30 items → 25 + 5, no overlap; tampered cursor → 400", async () => {
    for (let i = 0; i < 30; i++) {
      await seed({ status: "failed", analysed: false, publishedAt: new Date(AT.getTime() - (i % 3) * 1000) });
    }
    const p1 = await queue("limit=25");
    expect(p1.items).toHaveLength(25);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await queue(`limit=25&cursor=${p1.nextCursor}`);
    expect(p2.items).toHaveLength(5);
    expect(p2.nextCursor).toBeNull();
    const ids = new Set([...p1.items, ...p2.items].map((i) => i.id));
    expect(ids.size).toBe(30);
    const bad = encodeSortCursor({ sort: "review_newest", keys: ["not-a-time"], id: randomUUID() });
    const r = await api(app, viewer).get(`${base()}/reviews?cursor=${bad}`);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
