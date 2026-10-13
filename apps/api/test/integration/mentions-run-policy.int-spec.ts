import { randomUUID } from "node:crypto";
import { SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { api, createActor, createPost, createProject, createQuery, createTestApp, resetDb } from "../helpers";

/**
 * #220: Mentions list/detail use the confidence bands and safety thresholds of the policy the run that produced
 * the current analysis used (doc 08 §8, BR-021, BR-017); no settings row → v1. One row per post (BR-002).
 */
const WEEK = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" };

describe("Mentions run-policy bands (#220)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let queryId: string;
  let viewer: string;
  let seq = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(async () => app.close());
  beforeEach(async () => {
    await resetDb(prisma);
    seq = 0;
    projectId = (await createProject(prisma)).id;
    queryId = (await createQuery(prisma, { projectId })).id;
    viewer = (await createActor(prisma, { projectId, role: "viewer" })).token;
  });

  async function seedV2Settings(pid: string) {
    await prisma.analysisSetting.create({
      data: {
        id: randomUUID(),
        projectId: pid,
        version: 2,
        policyVersion: "safety-policy-v2",
        confidenceBands: { high: 0.8, medium: 0.7 },
        safetyThresholds: { ...SAFETY_POLICY_V1, harassment: { sensitive: 0.7, severe: 0.9 } },
      },
    });
  }

  async function seed(pid: string, policyVersion: string) {
    seq += 1;
    const at = new Date(`2026-10-02T00:00:${String(seq).padStart(2, "0")}Z`);
    const post = await createPost(prisma, { projectId: pid, publishedAt: at, firstSeenAt: at });
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
        effectiveVersion: "v",
        safetyPolicyVersion: policyVersion,
        completedAt: at,
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId: pid,
        relevanceLabel: "relevant",
        relevanceConfidence: 0.9,
        sentimentLabel: "neutral",
        safetyLevel: "sensitive",
        safetyFlagged: false,
        // Pipeline shape (doc 07 §6).
        safetyCategoryScores: { scores: { harassment: 0.6, hate: 0.1 }, triggered: [] },
        overallModelConfidence: 0.65,
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  const list = (pid: string) =>
    api(app, viewer).get(`/projects/${pid}/mentions?${new URLSearchParams({ ...WEEK, count: "true" }).toString()}`);

  it("BR-021: v2 run → low, v1 run → medium (list + detail), no duplicated rows (BR-002)", async () => {
    await seedV2Settings(projectId);
    const v2 = await seed(projectId, "safety-policy-v2");
    const v1 = await seed(projectId, "safety-policy-v1");
    const res = await list(projectId).expect(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.items).toHaveLength(2);
    const band = (id: string) =>
      (res.body.items as { id: string; analysis: { confidenceBand: string } }[]).find((i) => i.id === id)?.analysis
        .confidenceBand;
    expect(band(v2)).toBe("low");
    expect(band(v1)).toBe("medium");

    const d2 = await api(app, viewer).get(`/projects/${projectId}/mentions/${v2}`).expect(200);
    expect(d2.body.analysis.confidenceBand).toBe("low");
    const d1 = await api(app, viewer).get(`/projects/${projectId}/mentions/${v1}`).expect(200);
    expect(d1.body.analysis.confidenceBand).toBe("medium");

    // Same post sits in the review queue's low-confidence tab (FR-195) — Mentions and Reviews agree.
    const low = await api(app, viewer).get(`/projects/${projectId}/reviews?reason=low_confidence`).expect(200);
    expect((low.body.items as { id: string }[]).map((i) => i.id)).toEqual([v2]);
  });

  it("BR-017: safetyTriggered uses the run policy thresholds; scores read from { scores, triggered }", async () => {
    await seedV2Settings(projectId);
    const v2 = await seed(projectId, "safety-policy-v2");
    const v1 = await seed(projectId, "safety-policy-v1");
    const d2 = await api(app, viewer).get(`/projects/${projectId}/mentions/${v2}`).expect(200);
    expect(d2.body.analysis.safetyCategoryScores).toEqual({ harassment: 0.6, hate: 0.1 });
    expect(d2.body.analysis.safetyTriggered).toEqual([]);
    const d1 = await api(app, viewer).get(`/projects/${projectId}/mentions/${v1}`).expect(200);
    expect(d1.body.analysis.safetyTriggered).toEqual([{ category: "harassment", score: 0.6, level: "sensitive" }]);
  });

  it("project without settings row → v1 bands even for an unknown policy version", async () => {
    const id = await seed(projectId, "safety-policy-v2");
    const res = await list(projectId).expect(200);
    expect(res.body.items[0].analysis.confidenceBand).toBe("medium");
    const d = await api(app, viewer).get(`/projects/${projectId}/mentions/${id}`).expect(200);
    expect(d.body.analysis.confidenceBand).toBe("medium");
  });
});
