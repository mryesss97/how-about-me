import { randomUUID } from "node:crypto";
import { AnalyticsQuerySchema } from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import type { PrismaService } from "../../src/database/prisma.service";
import { resolveAnalyticsQuery } from "../../src/modules/analytics/analytics-filters";
import { AnalyticsTimeseriesService } from "../../src/modules/analytics/analytics-timeseries.service";
import { api, createActor } from "../helpers/actors";
import { createTestApp, resetDb } from "../helpers/app";
import { createPost, createProject, createQuery } from "../helpers/factories";

type Point = { time: string; mentions: number; previous?: number };

/**
 * T-092 mentions timeseries against real Postgres — FR-135 (bucket/tz/zero-fill), FR-136 (sentiment variant),
 * FR-141 (previous), FR-147 (DISTINCT post), BR-016 (default relevance); TC-DASH-002/012/017.
 */
describe("Analytics mentions timeseries (T-092)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let q2: string;
  let token: string;
  const now = new Date("2026-10-13T05:00:00Z");

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

  async function seedPost(at: string, opts: { matches?: string[]; relevance?: string; sentiment?: string } = {}) {
    const post = await createPost(prisma, { projectId, publishedAt: new Date(at), firstSeenAt: new Date(at) });
    for (const queryId of opts.matches ?? [q1]) {
      await prisma.postQueryMatch.create({
        data: {
          postId: post.id,
          queryId,
          excludedByTerms: false,
          firstMatchedAt: post.publishedAt,
          lastMatchedAt: now,
        },
      });
    }
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
        completedAt: now,
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId,
        relevanceLabel: (opts.relevance ?? "relevant") as "relevant",
        sentimentLabel: (opts.sentiment ?? "neutral") as "neutral",
        safetyLevel: "safe",
        languageCode: "vi",
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
  }

  const get = async (q: Record<string, string>, status = 200) => {
    const res = await api(app, token).get(`/projects/${projectId}/analytics/mentions-timeseries`).query(q);
    expect(res.status).toBe(status);
    return res.body as { interval: string; timezone: string; data: Point[] };
  };
  const sum = (d: Point[]) => d.reduce((a, p) => a + p.mentions, 0);
  const WEEK = { from: "2026-10-01T00:00:00+07:00", to: "2026-10-08T00:00:00+07:00" };

  it("TC-DASH-012: sparse week → 7 zero-filled day buckets, sum = distinct posts; +07 bucketing", async () => {
    await seedPost("2026-10-02T03:00:00Z");
    await seedPost("2026-10-04T12:00:00Z");
    await seedPost("2026-10-04T17:30:00Z"); // local 2026-10-05 00:30 +07
    const body = await get(WEEK);
    expect(body.interval).toBe("day");
    expect(body.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(body.data.map((p) => p.time)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07"].map((d) => `2026-10-${d}T00:00:00+07:00`),
    );
    expect(body.data.map((p) => p.mentions)).toEqual([0, 1, 0, 1, 1, 0, 0]);
    expect(sum(body.data)).toBe(3);
  });

  it("TC-DASH-002: 24 h → 24 hour buckets; 30 d → 30 day buckets; hour override > 31 d → 400", async () => {
    expect((await get({ from: "2026-10-01T00:00:00+07:00", to: "2026-10-02T00:00:00+07:00" })).data).toHaveLength(24);
    const month = await get({ from: "2026-09-01T00:00:00+07:00", to: "2026-10-01T00:00:00+07:00" });
    expect(month.interval).toBe("day");
    expect(month.data).toHaveLength(30);
    const wk = await get({ ...WEEK, interval: "hour" });
    expect(wk.interval).toBe("hour");
    expect(wk.data).toHaveLength(168);
    const res = await api(app, token)
      .get(`/projects/${projectId}/analytics/mentions-timeseries`)
      .query({ from: "2026-08-01T00:00:00+07:00", to: "2026-10-01T00:00:00+07:00", interval: "hour" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("FR-147 + BR-016: multi-match counted once; irrelevant only with relevance=irrelevant", async () => {
    await seedPost("2026-10-02T03:00:00Z", { matches: [q1, q2] });
    await seedPost("2026-10-02T04:00:00Z", { relevance: "irrelevant" });
    expect(sum((await get(WEEK)).data)).toBe(1);
    expect(sum((await get({ ...WEEK, relevance: "irrelevant" })).data)).toBe(1);
    expect(sum((await get({ ...WEEK, relevance: "relevant,irrelevant" })).data)).toBe(2);
  });

  it("FR-141/TC-DASH-017: compare=true adds aligned previous; compare=false has no previous key", async () => {
    await seedPost("2026-09-24T03:00:00Z"); // previous day 0 (local 09-24)
    await seedPost("2026-09-30T03:00:00Z"); // previous day 6
    await seedPost("2026-10-01T03:00:00Z"); // current day 0
    const body = await get({ ...WEEK, compare: "true" });
    expect(body.data.map((p) => p.previous)).toEqual([1, 0, 0, 0, 0, 0, 1]);
    expect(body.data[0]?.mentions).toBe(1);
    for (const p of (await get(WEEK)).data) expect(p).not.toHaveProperty("previous");
  });

  it("non-aligned range: first bucket partial, all buckets present, total correct", async () => {
    await seedPost("2026-10-01T03:40:00Z"); // 10:40 local, inside
    await seedPost("2026-10-01T03:10:00Z"); // 10:10 local, before from
    const body = await get({ from: "2026-10-01T10:30:00+07:00", to: "2026-10-01T13:00:00+07:00" });
    expect(body.data.map((p) => p.time)).toEqual([
      "2026-10-01T10:00:00+07:00",
      "2026-10-01T11:00:00+07:00",
      "2026-10-01T12:00:00+07:00",
    ]);
    expect(body.data.map((p) => p.mentions)).toEqual([1, 0, 0]);
  });

  it("DST tz (America/New_York, across 2026-11-01): one day bucket per local day", async () => {
    await seedPost("2026-11-01T12:00:00Z");
    const body = await get({
      from: "2026-10-30T00:00:00-04:00",
      to: "2026-11-03T00:00:00-05:00",
      timezone: "America/New_York",
    });
    expect(body.data.map((p) => p.time)).toEqual([
      "2026-10-30T00:00:00-04:00",
      "2026-10-31T00:00:00-04:00",
      "2026-11-01T00:00:00-04:00",
      "2026-11-02T00:00:00-05:00",
    ]);
    expect(body.data.map((p) => p.mentions)).toEqual([0, 0, 1, 0]);
    // Spring-forward: local 02:00 does not exist → no duplicate 03:00 bucket.
    await seedPost("2026-03-08T07:30:00Z"); // 03:30 EDT
    const spring = await get({
      from: "2026-03-08T00:00:00-05:00",
      to: "2026-03-08T05:00:00-04:00",
      timezone: "America/New_York",
    });
    expect(spring.data.map((p) => p.time)).toEqual([
      "2026-03-08T00:00:00-05:00",
      "2026-03-08T01:00:00-05:00",
      "2026-03-08T03:00:00-04:00",
      "2026-03-08T04:00:00-04:00",
    ]);
    expect(spring.data.map((p) => p.mentions)).toEqual([0, 0, 1, 0]);
  });

  it("FR-136: sentiment variant zero-fills; per-bucket labels sum to posts in bucket", async () => {
    await seedPost("2026-10-02T03:00:00Z", { sentiment: "positive" });
    await seedPost("2026-10-02T04:00:00Z", { sentiment: "negative" });
    await seedPost("2026-10-04T04:00:00Z", { sentiment: "neutral" });
    const { scope } = resolveAnalyticsQuery(
      AnalyticsQuerySchema.parse(WEEK),
      { id: projectId, timezone: "Asia/Ho_Chi_Minh" },
      now,
    );
    const ts = await app.get(AnalyticsTimeseriesService).sentimentTimeseries(scope);
    expect(ts.interval).toBe("day");
    expect(ts.data).toHaveLength(7);
    expect(ts.data[1]).toMatchObject({ positive: 1, neutral: 0, negative: 1 });
    expect(ts.data[3]).toMatchObject({ positive: 0, neutral: 1, negative: 0 });
    expect(ts.data[0]).toMatchObject({ positive: 0, neutral: 0, negative: 0 });
  });

  it("validation and access: range > 366 d → 400; non-member → 403", async () => {
    const res = await api(app, token)
      .get(`/projects/${projectId}/analytics/mentions-timeseries`)
      .query({ from: "2025-01-01T00:00:00Z", to: "2026-10-01T00:00:00Z" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const outsider = await createActor(prisma);
    const denied = await api(app, outsider.token).get(`/projects/${projectId}/analytics/mentions-timeseries`);
    expect(denied.status).toBe(403);
  });
});
