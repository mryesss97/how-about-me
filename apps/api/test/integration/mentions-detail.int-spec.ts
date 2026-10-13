import { randomUUID } from "node:crypto";
import { MentionDetailSchema } from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { api, createActor, createPost, createProject, createQuery, createTestApp, resetDb } from "../helpers";

/** T-096: GET …/mentions/:mentionId — FR-154, BR-003, BR-010, BR-017, BR-025; TC-MEN-008/010/011/012. */
describe("Mention detail (T-096)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let otherProjectId: string;
  let viewer: string;

  const url = (pid: string, mid: string) => `/projects/${pid}/mentions/${mid}`;

  async function seedRun(
    postId: string,
    contentHash: string,
    over: {
      status: "pending" | "completed" | "failed";
      createdAt: Date;
      completedAt?: Date;
      errorCode?: string;
      cost?: number;
    },
  ): Promise<string> {
    const id = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id,
        postId,
        projectId,
        status: over.status,
        trigger: "ingest",
        sourceContentHash: contentHash,
        sourceRevision: 1,
        effectiveVersion: "v1",
        classifierProvider: "openai",
        classifierModel: "gpt-x",
        promptVersion: "prompt-v1",
        taxonomyVersion: "taxonomy-v1",
        safetyProvider: "openai",
        safetyModel: "omni-moderation",
        safetyPolicyVersion: "safety-policy-v1",
        inputTokens: 100,
        outputTokens: 20,
        estimatedCostUsd: over.cost ?? null,
        createdAt: over.createdAt,
        completedAt: over.completedAt ?? null,
        errorCode: over.errorCode ?? null,
      },
    });
    return id;
  }

  async function seedAnalysed(opts: { relevance?: "relevant" | "irrelevant"; publishedAt?: Date } = {}) {
    const post = await createPost(prisma, {
      projectId,
      ...(opts.publishedAt ? { publishedAt: opts.publishedAt } : {}),
    });
    const runId = await seedRun(post.id, post.contentHash, {
      status: "completed",
      createdAt: new Date("2026-10-01T00:00:00Z"),
      completedAt: new Date("2026-10-01T00:01:00Z"),
      cost: 0.0012,
    });
    const analysisId = randomUUID();
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId,
        relevanceLabel: opts.relevance ?? "relevant",
        relevanceConfidence: 0.9,
        relevanceExplanation: "mentions the brand",
        sentimentLabel: "negative",
        safetyLevel: "sensitive",
        safetyFlagged: false,
        safetyCategoryScores: { harassment: 0.6, hate: 0.1 },
        overallModelConfidence: 0.85,
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return { post, runId, analysisId };
  }

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDb(prisma);
    projectId = (await createProject(prisma)).id;
    otherProjectId = (await createProject(prisma)).id;
    viewer = (await createActor(prisma, { projectId, role: "viewer" })).token;
  });
  afterAll(async () => app.close());

  it("TC-MEN-008 / BR-010: viewer → 200, contract-valid, source extras + matches incl. soft-deleted & excluded", async () => {
    const { post } = await seedAnalysed();
    const live = await createQuery(prisma, { projectId });
    const gone = await createQuery(prisma, { projectId, deletedAt: new Date() });
    const now = new Date();
    for (const [queryId, excludedByTerms] of [
      [live.id, false],
      [gone.id, true],
    ] as const) {
      await prisma.postQueryMatch.create({
        data: { postId: post.id, queryId, excludedByTerms, firstMatchedAt: now, lastMatchedAt: now },
      });
    }
    const res = await api(app, viewer).get(url(projectId, post.id)).expect(200);
    const body = MentionDetailSchema.parse(res.body);
    expect(body).toMatchObject({ id: post.id, contentHash: post.contentHash, revision: 1 });
    expect(body.firstSeenAt).toMatch(/Z$/);
    expect(body.matchedQueries.map((m) => [m.id, m.excludedByTerms]).sort()).toEqual(
      [
        [live.id, false],
        [gone.id, true],
      ].sort(),
    );
    // T-050 whitelist: no raw provider payload / secrets.
    expect(res.body).not.toHaveProperty("rawData");
    expect(res.body).not.toHaveProperty("raw_data");
    expect(res.body.analysis).not.toHaveProperty("errorMessage");
  });

  it("TC-MEN-010 / BR-017: category scores + triggered categories", async () => {
    const { post } = await seedAnalysed();
    const { body } = await api(app, viewer).get(url(projectId, post.id)).expect(200);
    expect(body.analysis.safetyCategoryScores).toEqual({ harassment: 0.6, hate: 0.1 });
    expect(body.analysis.safetyTriggered).toEqual([{ category: "harassment", score: 0.6, level: "sensitive" }]);
    expect(body.analysis.relevanceExplanation).toBe("mentions the brand");
    expect(body.analysis.sentiment.label).toBe("negative");
  });

  it("TC-MEN-011/012 / BR-003: versions of the current analysis run, runs DESC with cost; labels kept while new run pending", async () => {
    const { post, runId } = await seedAnalysed();
    const failed = await seedRun(post.id, post.contentHash, {
      status: "failed",
      createdAt: new Date("2026-10-02T00:00:00Z"),
      errorCode: "OPENAI_TIMEOUT",
    });
    const pending = await seedRun(post.id, post.contentHash, {
      status: "pending",
      createdAt: new Date("2026-10-03T00:00:00Z"),
    });
    await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: "pending" } });
    const { body } = await api(app, viewer).get(url(projectId, post.id)).expect(200);
    expect(body.analysis.versions).toEqual({
      classifierProvider: "openai",
      classifierModel: "gpt-x",
      promptVersion: "prompt-v1",
      taxonomyVersion: "taxonomy-v1",
      safetyProvider: "openai",
      safetyModel: "omni-moderation",
      safetyPolicyVersion: "safety-policy-v1",
    });
    expect(body.analysis.analyzedAt).toBe("2026-10-01T00:01:00.000Z");
    expect(body.analysis.tokens).toEqual({ input: 100, output: 20 });
    expect(body.analysis.estimatedCostUsd).toBeCloseTo(0.0012);
    expect(body.analysis.status).toBe("pending");
    expect(body.analysis.relevance.label).toBe("relevant");
    expect(body.runs.map((r: { id: string }) => r.id)).toEqual([pending, failed, runId]);
    expect(body.runs[1]).toMatchObject({ status: "failed", errorCode: "OPENAI_TIMEOUT", effectiveVersion: "v1" });
    expect(body.runs[2].estimatedCostUsd).toBeCloseTo(0.0012);
  });

  it("no base-set filter: irrelevant and old posts → 200; unanalysed post → nulls", async () => {
    const { post } = await seedAnalysed({ relevance: "irrelevant", publishedAt: new Date("2025-01-01T00:00:00Z") });
    await api(app, viewer).get(url(projectId, post.id)).expect(200);
    const bare = await createPost(prisma, { projectId });
    const { body } = await api(app, viewer).get(url(projectId, bare.id)).expect(200);
    expect(MentionDetailSchema.parse(body).analysis).toMatchObject({
      status: "pending",
      versions: null,
      tokens: null,
      analyzedAt: null,
      safetyCategoryScores: null,
      safetyTriggered: null,
    });
    expect(body.runs).toEqual([]);
  });

  it("404 cross-project / unknown, 400 non-UUID, 403 non-member", async () => {
    const other = await createPost(prisma, { projectId: otherProjectId });
    const r1 = await api(app, viewer).get(url(projectId, other.id)).expect(404);
    expect(r1.body.error.code).toBe("NOT_FOUND");
    await api(app, viewer).get(url(projectId, randomUUID())).expect(404);
    await api(app, viewer).get(url(projectId, "not-a-uuid")).expect(400);
    const outsider = (await createActor(prisma)).token;
    const mine = await createPost(prisma, { projectId });
    await api(app, outsider).get(url(projectId, mine.id)).expect(403);
  });
});
