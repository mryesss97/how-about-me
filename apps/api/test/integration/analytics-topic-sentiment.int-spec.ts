import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { addMember, createPost, createProject, createQuery, createUser } from "../helpers/factories";

/**
 * T-149 topic × sentiment matrix — FR-144, FR-140, FR-142, FR-147, BR-016, BR-025; TC-DASH-027;
 * docs/01-product/07-metric-definitions.md §4.
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  topics?: string[];
};
type Row = {
  topic: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  negativeShare: number | null;
};

describe("Analytics topic × sentiment (T-149)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let q2: string;
  let reviewer: string;
  const tokens: Record<"viewer" | "outsider", string> = { viewer: "", outsider: "" };
  const now = new Date("2026-10-13T05:00:00Z");
  const WEEK = { from: "2026-10-01T00:00:00+07:00", to: "2026-10-08T00:00:00+07:00" };

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
    reviewer = (await createUser(prisma)).id;
    const viewer = await createUser(prisma);
    await addMember(prisma, { projectId, userId: viewer.id, role: "viewer" });
    const outsider = await createUser(prisma);
    tokens.viewer = await mintTestJwt({ sub: viewer.id, email: viewer.email });
    tokens.outsider = await mintTestJwt({ sub: outsider.id, email: outsider.email });
  });

  async function seedPost(opts: { at: string; matches?: Record<string, boolean>; labels?: Labels | null }) {
    const post = await createPost(prisma, {
      projectId,
      publishedAt: new Date(opts.at),
      firstSeenAt: new Date(opts.at),
    });
    for (const [queryId, excludedByTerms] of Object.entries(opts.matches ?? { [q1]: false })) {
      await prisma.postQueryMatch.create({
        data: { postId: post.id, queryId, excludedByTerms, firstMatchedAt: post.publishedAt, lastMatchedAt: now },
      });
    }
    if (opts.labels === null) {
      await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: "pending" } });
      return post.id;
    }
    const l: Labels = { relevance: "relevant", sentiment: "neutral", ...opts.labels };
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
        relevanceLabel: l.relevance,
        sentimentLabel: l.sentiment,
        safetyLevel: "safe",
        languageCode: "vi",
        topics: { create: (l.topics ?? []).map((label) => ({ label })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  function override(postId: string, field: "sentiment" | "topics", value: string | string[]) {
    return prisma.analysisOverride.create({
      data: { id: randomUUID(), postId, projectId, field, overrideValue: { value }, reviewedBy: reviewer },
    });
  }

  const http = (path: string, query: Record<string, string> = WEEK, who: keyof typeof tokens = "viewer") =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/${path}`)
      .query(query)
      .set("authorization", `Bearer ${tokens[who]}`);

  async function matrix(query: Record<string, string> = WEEK): Promise<Row[]> {
    const res = await http("analytics/topic-sentiment", query);
    expect(res.status).toBe(200);
    return (res.body as { rows: Row[] }).rows;
  }
  const rowOf = (rows: Row[], topic: string) => rows.find((r) => r.topic === topic);

  it("TC-DASH-027 / FR-144: cells, row totals, negativeShare; multi-topic post counted per row; `other` last", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", topics: ["ticket", "venue"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "positive", topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "neutral", topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { sentiment: "negative", topics: ["other"] } });
    const rows = await matrix();
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({ topic: "ticket", positive: 1, neutral: 1, negative: 1, total: 3, negativeShare: 1 / 3 });
    expect(rows[1]).toEqual({ topic: "venue", positive: 0, neutral: 0, negative: 1, total: 1, negativeShare: 1 });
    expect(rows.at(-1)).toEqual({ topic: "other", positive: 0, neutral: 0, negative: 1, total: 1, negativeShare: 1 });
    expect(rowOf(rows, "price")).toMatchObject({ total: 0, negativeShare: null });
  });

  it("row denominator: a post with topics but no sentiment is not counted (metric-definitions §4)", async () => {
    const pending = await seedPost({ at: "2026-10-02T01:00:00Z", labels: null });
    await override(pending, "topics", ["ticket"]);
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "negative", topics: ["ticket"] } });
    expect(rowOf(await matrix(), "ticket")).toMatchObject({ negative: 1, total: 1 });
  });

  it("BR-025 / A9: sentiment and topic overrides replace AI labels", async () => {
    const a = await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "negative", topics: ["ticket"] } });
    const b = await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "positive", topics: ["artist"] } });
    await override(a, "sentiment", "neutral");
    await override(b, "topics", ["payment"]);
    const rows = await matrix();
    expect(rowOf(rows, "ticket")).toMatchObject({ negative: 1, neutral: 1, total: 2 });
    expect(rowOf(rows, "artist")?.total).toBe(0);
    expect(rowOf(rows, "payment")).toMatchObject({ positive: 1, total: 1 });
  });

  it("labels outside the taxonomy are ignored (not folded into `other`)", async () => {
    const p = await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", topics: ["ticket"] } });
    await override(p, "topics", ["legacy_label"]);
    const rows = await matrix();
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });

  it("TC-DASH-021 / FR-147: a post matched by two queries counts once", async () => {
    await seedPost({
      at: "2026-10-02T01:00:00Z",
      matches: { [q1]: false, [q2]: false },
      labels: { sentiment: "negative", topics: ["ticket"] },
    });
    expect(rowOf(await matrix(), "ticket")).toMatchObject({ negative: 1, total: 1 });
  });

  it("TC-DASH-020 / BR-016: irrelevant excluded by default, included with relevance=irrelevant", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { relevance: "irrelevant", topics: ["ticket"] } });
    expect(rowOf(await matrix(), "ticket")?.total).toBe(1);
    expect(rowOf(await matrix({ ...WEEK, relevance: "relevant,irrelevant" }), "ticket")?.total).toBe(2);
  });

  it("A18: a post matched only with excluded_by_terms is not counted", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", matches: { [q1]: true }, labels: { topics: ["ticket"] } });
    expect(rowOf(await matrix(), "ticket")?.total).toBe(0);
  });

  it("range is [from,to): a post exactly at `to` is excluded", async () => {
    await seedPost({ at: "2026-10-01T00:00:00+07:00", labels: { topics: ["ticket"] } });
    await seedPost({ at: "2026-10-08T00:00:00+07:00", labels: { topics: ["ticket"] } });
    expect(rowOf(await matrix(), "ticket")?.total).toBe(1);
  });

  it("filters: sentiment=negative keeps only the negative column; topic=ticket restricts other rows", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", topics: ["ticket", "venue"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "positive", topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "positive", topics: ["venue"] } });
    const neg = await matrix({ ...WEEK, sentiment: "negative" });
    expect(neg.every((r) => r.positive === 0 && r.neutral === 0)).toBe(true);
    expect(rowOf(neg, "ticket")?.negative).toBe(1);
    const ticket = await matrix({ ...WEEK, topic: "ticket" });
    expect(rowOf(ticket, "venue")).toMatchObject({ positive: 0, negative: 1, total: 1 });
  });

  it("A14 / FR-142: drill-down /mentions?topic&sentiment totalCount equals the cell (incl. `other`)", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", topics: ["ticket", "other"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "negative", topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "positive", topics: ["ticket"] } });
    const rows = await matrix();
    for (const topic of ["ticket", "other"]) {
      const list = await http("mentions", { ...WEEK, topic, sentiment: "negative", count: "true" });
      expect(list.status).toBe(200);
      expect(list.body.totalCount).toBe(rowOf(rows, topic)?.negative);
    }
    expect(rowOf(rows, "ticket")?.negative).toBe(2);
  });

  it("FR-140: no data → 12 rows of 0 with negativeShare null", async () => {
    const rows = await matrix();
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.total === 0 && r.negativeShare === null)).toBe(true);
  });

  it("FR-015: viewer 200, non-member denied, invalid range 400, unknown project 404", async () => {
    expect((await http("analytics/topic-sentiment")).status).toBe(200);
    expect([403, 404]).toContain((await http("analytics/topic-sentiment", WEEK, "outsider")).status);
    const bad = await http("analytics/topic-sentiment", { from: WEEK.to, to: WEEK.from });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });
});
