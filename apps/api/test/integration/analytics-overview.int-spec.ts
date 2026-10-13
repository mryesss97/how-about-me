import { randomUUID } from "node:crypto";
import { OverviewResponseSchema } from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import {
  api,
  createActor,
  createPost,
  createProject,
  createQuery,
  createTestApp,
  createUser,
  resetDb,
} from "../helpers";

/**
 * T-091 overview endpoint — FR-132/133/134/140/141/147, BR-016, BR-025; analytics QA A1–A4, A11, A12;
 * TC-DASH-007/008/013/026.
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  safety?: "safe" | "sensitive" | "severe";
  intents?: string[];
};

describe("Analytics overview (T-091)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let q2: string;
  let token: string;
  // Range: 2026-10-05..2026-10-12 local (Asia/Ho_Chi_Minh); previous = 2026-09-28..10-05.
  const range = "from=2026-10-05T00:00:00%2B07:00&to=2026-10-12T00:00:00%2B07:00";
  const url = (extra = "") => `/projects/${projectId}/analytics/overview?${range}${extra}`;
  const IN = "2026-10-06T03:00:00Z";
  const PREV = "2026-09-30T03:00:00Z";

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
    q1 = (await createQuery(prisma, { projectId })).id;
    q2 = (await createQuery(prisma, { projectId })).id;
    token = (await createActor(prisma, { projectId, role: "viewer" })).token;
  });

  /** `status` other than completed → no analysis, only latest_run_status. */
  async function seedPost(
    at: string,
    labels: Labels = {},
    opts: { status?: "pending" | "failed"; queries?: string[] } = {},
  ) {
    const post = await createPost(prisma, { projectId, publishedAt: new Date(at), firstSeenAt: new Date(at) });
    for (const queryId of opts.queries ?? [q1]) {
      await prisma.postQueryMatch.create({
        data: {
          postId: post.id,
          queryId,
          excludedByTerms: false,
          firstMatchedAt: new Date(at),
          lastMatchedAt: new Date(at),
        },
      });
    }
    if (opts.status) {
      await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: opts.status } });
      return post.id;
    }
    const l = { relevance: "relevant", sentiment: "neutral", safety: "safe", ...labels } as const;
    const runId = randomUUID();
    const analysisId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId: post.id,
        projectId,
        status: "completed",
        trigger: "ingest",
        sourceContentHash: post.contentHash,
        sourceRevision: 1,
        effectiveVersion: "test-v1",
        completedAt: new Date(at),
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId,
        relevanceLabel: l.relevance,
        sentimentLabel: l.sentiment,
        safetyLevel: l.safety,
        languageCode: "vi",
        intents: { create: (labels.intents ?? []).map((label) => ({ label })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  async function getOverview(extra = "") {
    const res = await api(app, token).get(url(extra));
    expect(res.status).toBe(200);
    return OverviewResponseSchema.parse(res.body);
  }

  it("counts a post matching two queries once (A1/A2, FR-147) and sentiment sums to denominator (A3, TC-DASH-013)", async () => {
    await seedPost(IN, { sentiment: "positive" }, { queries: [q1, q2] });
    await seedPost(IN, { sentiment: "negative" });
    await seedPost(IN, { sentiment: "neutral" });
    const body = await getOverview();
    expect(body.kpis.mentionCount.value).toBe(3);
    const { positiveRate: p, negativeRate: n } = body.kpis;
    expect(p.denominator).toBe(3);
    expect(p.numerator + n.numerator + 1).toBe(p.denominator);
    expect(p.value).toBeCloseTo(1 / 3);
    expect(body.meta.metricsVersion).toBe("metrics-v1"); // TC-DASH-026
    expect(body.range.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(body.range.from).toBe("2026-10-05T00:00:00+07:00");
    expect(body.range.previous).toBeUndefined();
    expect(p.previous).toBeUndefined();
  });

  it("pending post is out of the safety denominator but in coverage (A4)", async () => {
    await seedPost(IN, { safety: "severe" });
    await seedPost(IN, { safety: "sensitive" });
    await seedPost(IN, { safety: "safe" });
    await seedPost(IN, {}, { status: "pending" });
    await seedPost(IN, {}, { status: "failed" });
    const body = await getOverview();
    expect(body.kpis.safetyRiskRate).toMatchObject({ numerator: 2, denominator: 3, severeCount: 1 });
    expect(body.coverage).toMatchObject({
      relevantMentions: 3,
      analyzedMentions: 3,
      pendingMentions: 1,
      failedMentions: 1,
    });
  });

  it("only pending posts → rates are null with denominator 0 (TC-DASH-008, A12)", async () => {
    await seedPost(IN, {}, { status: "pending" });
    const body = await getOverview();
    for (const r of [
      body.kpis.positiveRate,
      body.kpis.negativeRate,
      body.kpis.safetyRiskRate,
      body.kpis.complaintRate,
    ]) {
      expect(r.value).toBeNull();
      expect(r.denominator).toBe(0);
    }
  });

  it("compare=true with empty previous period → growthState new (TC-DASH-007, A11, FR-141)", async () => {
    await seedPost(IN);
    const body = await getOverview("&compare=true");
    expect(body.kpis.mentionCount).toMatchObject({ value: 1, previous: 0, growthPct: null, growthState: "new" });
    expect(body.range.previous).toEqual({ from: "2026-09-28T00:00:00+07:00", to: "2026-10-05T00:00:00+07:00" });
    expect(body.kpis.positiveRate.previous).toBeNull();
  });

  it("growth computed vs previous period even when compare=false", async () => {
    await seedPost(IN);
    await seedPost(IN);
    await seedPost(PREV, { sentiment: "positive" });
    const body = await getOverview();
    expect(body.kpis.mentionCount).toMatchObject({ value: 2, previous: 1, growthPct: 100, growthState: "up" });
    const cmp = await getOverview("&compare=true");
    expect(cmp.kpis.positiveRate.previous).toBe(1);
  });

  it("relevance override to irrelevant excludes the post (BR-025); irrelevant/uncertain only in coverage (BR-016)", async () => {
    const overridden = await seedPost(IN);
    await seedPost(IN, { relevance: "uncertain" });
    await seedPost(IN, { relevance: "irrelevant" });
    await seedPost(IN);
    const reviewer = (await createUser(prisma)).id;
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: overridden,
        projectId,
        field: "relevance",
        overrideValue: { value: "irrelevant" },
        reviewedBy: reviewer,
      },
    });
    const body = await getOverview();
    expect(body.kpis.mentionCount.value).toBe(1);
    expect(body.coverage).toMatchObject({
      relevantMentions: 1,
      irrelevantMentions: 2,
      uncertainMentions: 1,
      analyzedMentions: 4,
    });
  });

  it("complaintRate uses posts with intents as denominator", async () => {
    await seedPost(IN, { intents: ["complaint", "question"] });
    await seedPost(IN, { intents: ["question"] });
    await seedPost(IN);
    const body = await getOverview();
    expect(body.kpis.complaintRate).toMatchObject({ numerator: 1, denominator: 2, value: 0.5 });
  });

  it("dataQuality: no job → none; open circuit → paused; no integration → disconnected", async () => {
    let body = await getOverview();
    expect(body.dataQuality).toEqual({
      lastSyncStatus: "none",
      lastSyncAt: null,
      integrationStatus: "disconnected",
      collectorStatus: "degraded",
    });
    await prisma.collectorState.create({ data: { projectId, circuitOpenUntil: new Date(Date.now() + 3_600_000) } });
    body = await getOverview();
    expect(body.dataQuality.collectorStatus).toBe("paused");
  });

  it("non-member → 403; range > 366 days → 400 VALIDATION_ERROR", async () => {
    const outsider = await createActor(prisma);
    const res = await api(app, outsider.token).get(url());
    expect(res.status).toBe(403);
    const bad = await api(app, token).get(
      `/projects/${projectId}/analytics/overview?from=2024-01-01T00:00:00Z&to=2026-01-01T00:00:00Z`,
    );
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });
});
