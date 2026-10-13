import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { addMember, createPost, createProject, createQuery, createUser } from "../helpers/factories";

/**
 * T-093 distribution endpoints — FR-136…FR-140, FR-147; TC-DASH-013/014/015/016/021;
 * docs/01-product/07-metric-definitions.md §3.2–3.6.
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  safety?: "safe" | "sensitive" | "severe";
  intents?: string[];
  topics?: string[];
  /** Defaults to "vi"; `null` = no language assigned. */
  language?: string | null;
};
type Item = { label: string; count: number; share: number | null };
type Dist = { denominator: number; distribution: Item[] };

describe("Analytics distributions (T-093)", () => {
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
    const l: Labels = { relevance: "relevant", sentiment: "neutral", safety: "safe", language: "vi", ...opts.labels };
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
        safetyLevel: l.safety,
        languageCode: l.language,
        intents: { create: (l.intents ?? []).map((label) => ({ label })) },
        topics: { create: (l.topics ?? []).map((label) => ({ label })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  function override(postId: string, field: "sentiment" | "safety_level", value: string) {
    return prisma.analysisOverride.create({
      data: { id: randomUUID(), postId, projectId, field, overrideValue: { value }, reviewedBy: reviewer },
    });
  }

  const get = (path: string, query: Record<string, string> = WEEK, who: keyof typeof tokens = "viewer") =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/analytics/${path}`)
      .query(query)
      .set("authorization", `Bearer ${tokens[who]}`);

  async function dist(path: string, query?: Record<string, string>): Promise<Dist> {
    const res = await get(path, query);
    expect(res.status).toBe(200);
    return res.body as Dist;
  }
  const countOf = (d: Dist, label: string) => d.distribution.find((x) => x.label === label)?.count;

  it("TC-DASH-013 / BR-025: sentiment sums to denominator, pending excluded, override applied", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "positive" } });
    const p2 = await seedPost({ at: "2026-10-02T04:00:00Z", labels: { sentiment: "positive" } });
    await seedPost({ at: "2026-10-02T05:00:00Z", labels: { sentiment: "negative" } });
    await seedPost({ at: "2026-10-02T06:00:00Z", labels: null });
    await override(p2, "sentiment", "negative");
    const d = await dist("sentiment");
    expect(d.denominator).toBe(3);
    expect(d.distribution.map((x) => [x.label, x.count])).toEqual([
      ["positive", 1],
      ["neutral", 0],
      ["negative", 2],
    ]);
    expect(d.distribution.reduce((s, x) => s + x.count, 0)).toBe(d.denominator);
  });

  it("TC-DASH-014 / BR-025: safety sums to denominator with override", async () => {
    const p = await seedPost({ at: "2026-10-02T03:00:00Z" });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { safety: "sensitive" } });
    await override(p, "safety_level", "severe");
    const d = await dist("safety");
    expect(d.denominator).toBe(2);
    expect(d.distribution.map((x) => [x.label, x.count])).toEqual([
      ["safe", 0],
      ["sensitive", 1],
      ["severe", 1],
    ]);
  });

  it("TC-DASH-015: multi-topic post counted once per label, shares may exceed 100 %, `other` is distinct", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { topics: ["ticket", "venue", "other"] } });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { topics: ["ticket"] } });
    await seedPost({ at: "2026-10-02T05:00:00Z", labels: { topics: ["other"] } });
    await seedPost({ at: "2026-10-02T06:00:00Z" }); // no topic → outside topicAnalyzed
    const d = await dist("topics");
    expect(d.denominator).toBe(3);
    expect(d.distribution.slice(0, 2).map((x) => [x.label, x.count])).toEqual([
      ["ticket", 2],
      ["venue", 1],
    ]);
    expect(d.distribution.at(-1)).toEqual({ label: "other", count: 2, share: 2 / 3 });
    expect(d.distribution).toHaveLength(12); // 11 real labels + other bucket
    expect(d.distribution.reduce((s, x) => s + (x.share ?? 0), 0)).toBeGreaterThan(1);
  });

  it("TC-DASH-016: all 11 intent labels returned, sorted desc, shares may exceed 100 %", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { intents: ["complaint", "question"] } });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { intents: ["complaint"] } });
    const d = await dist("intents");
    expect(d.denominator).toBe(2);
    expect(d.distribution).toHaveLength(11);
    expect(d.distribution[0]).toEqual({ label: "complaint", count: 2, share: 1 });
    expect(d.distribution[1]).toEqual({ label: "question", count: 1, share: 0.5 });
    expect(d.distribution.reduce((s, x) => s + (x.share ?? 0), 0)).toBe(1.5);
  });

  it("TC-DASH-021 / FR-147: a post matched by two queries counts once on every endpoint", async () => {
    await seedPost({
      at: "2026-10-02T03:00:00Z",
      matches: { [q1]: false, [q2]: false },
      labels: { sentiment: "negative", intents: ["complaint"], topics: ["ticket"] },
    });
    expect((await dist("sentiment")).denominator).toBe(1);
    expect((await dist("safety")).denominator).toBe(1);
    expect(countOf(await dist("intents"), "complaint")).toBe(1);
    expect(countOf(await dist("topics"), "ticket")).toBe(1);
  });

  it("BR-016: irrelevant excluded by default, included with relevance=irrelevant", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z" });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { relevance: "irrelevant" } });
    expect((await dist("sentiment")).denominator).toBe(1);
    expect((await dist("sentiment", { ...WEEK, relevance: "relevant,irrelevant" })).denominator).toBe(2);
  });

  it("range is [from,to): a post exactly at `to` is excluded", async () => {
    await seedPost({ at: "2026-10-01T00:00:00+07:00" });
    await seedPost({ at: "2026-10-08T00:00:00+07:00" });
    expect((await dist("safety")).denominator).toBe(1);
  });

  it("denominator 0 → every label with count 0 and share null (FR-140)", async () => {
    for (const path of ["sentiment", "safety", "intents", "topics", "languages"]) {
      const d = await dist(path);
      expect(d.denominator).toBe(0);
      expect(d.distribution.length).toBeGreaterThan(0);
      expect(d.distribution.every((x) => x.count === 0 && x.share === null)).toBe(true);
    }
  });

  it("FR-136: sentiment timeseries buckets by local day (Asia/Ho_Chi_Minh), zero-filled", async () => {
    // 2026-10-01T17:30Z = 2026-10-02 00:30 local → second bucket.
    await seedPost({ at: "2026-10-01T17:30:00Z", labels: { sentiment: "positive" } });
    await seedPost({ at: "2026-10-01T16:30:00Z", labels: { sentiment: "negative" } });
    const res = await get("sentiment");
    const ts = (res.body as { timeseries: { interval: string; data: Record<string, unknown>[] } }).timeseries;
    expect(ts.interval).toBe("day");
    expect(ts.data).toHaveLength(7);
    expect(ts.data[0]).toEqual({ time: "2026-10-01T00:00:00+07:00", positive: 0, neutral: 0, negative: 1 });
    expect(ts.data[1]).toEqual({ time: "2026-10-02T00:00:00+07:00", positive: 1, neutral: 0, negative: 0 });
    expect(ts.data[6]).toMatchObject({ time: "2026-10-07T00:00:00+07:00", positive: 0 });
  });

  it("hourly sentiment timeseries for ranges ≤ 48h", async () => {
    const res = await get("sentiment", { from: "2026-10-01T00:00:00+07:00", to: "2026-10-02T00:00:00+07:00" });
    const ts = (res.body as { timeseries: { interval: string; data: unknown[] } }).timeseries;
    expect(ts.interval).toBe("hour");
    expect(ts.data).toHaveLength(24);
  });

  it("RBAC: viewer 200, non-member denied; invalid range 400", async () => {
    expect((await get("topics")).status).toBe(200);
    expect([403, 404]).toContain((await get("topics", WEEK, "outsider")).status);
    const bad = await get("intents", { from: WEEK.to, to: WEEK.from });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });

  describe("languages (T-148, FR-143)", () => {
    it("TC-DASH-027: all 8 codes, count desc, ties in taxonomy order; NULL excluded, unknown counted, foreign → other", async () => {
      await seedPost({ at: "2026-10-02T03:00:00Z", labels: { language: "en" } });
      await seedPost({ at: "2026-10-02T04:00:00Z", labels: { language: "en" } });
      await seedPost({ at: "2026-10-02T05:00:00Z", labels: { language: "vi" } });
      await seedPost({ at: "2026-10-02T06:00:00Z", labels: { language: "unknown" } });
      await seedPost({ at: "2026-10-02T07:00:00Z", labels: { language: "fr" } });
      await seedPost({ at: "2026-10-02T08:00:00Z", labels: { language: null } });
      await seedPost({ at: "2026-10-02T09:00:00Z", labels: null });
      const d = await dist("languages");
      expect(d.denominator).toBe(5);
      expect(d.distribution.map((x) => x.label)).toEqual(["en", "vi", "other", "unknown", "ko", "ja", "th", "zh"]);
      expect(countOf(d, "other")).toBe(1);
      expect(countOf(d, "unknown")).toBe(1);
      expect(d.distribution[0]?.share).toBeCloseTo(0.4);
      expect(d.distribution.reduce((s, x) => s + (x.share ?? 0), 0)).toBeCloseTo(1);
    });

    it("FR-147: a post matched by two queries counts once", async () => {
      await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: false, [q2]: false } });
      const d = await dist("languages");
      expect(d.denominator).toBe(1);
      expect(countOf(d, "vi")).toBe(1);
    });

    it("BR-016: irrelevant excluded by default, included with relevance=irrelevant", async () => {
      await seedPost({ at: "2026-10-02T03:00:00Z" });
      await seedPost({ at: "2026-10-02T04:00:00Z", labels: { relevance: "irrelevant", language: "en" } });
      expect((await dist("languages")).denominator).toBe(1);
      const all = await dist("languages", { ...WEEK, relevance: "relevant,irrelevant" });
      expect(all.denominator).toBe(2);
      expect(countOf(all, "en")).toBe(1);
    });

    it("language filter keeps only matching posts", async () => {
      await seedPost({ at: "2026-10-02T03:00:00Z", labels: { language: "vi" } });
      await seedPost({ at: "2026-10-02T04:00:00Z", labels: { language: "en" } });
      const d = await dist("languages", { ...WEEK, language: "vi" });
      expect(d.denominator).toBe(1);
      expect(countOf(d, "en")).toBe(0);
    });

    it("#201 drill-down equivalence: language=other also matches codes outside the taxonomy, never NULL (FR-143)", async () => {
      await seedPost({ at: "2026-10-02T03:00:00Z", labels: { language: "vi" } });
      await seedPost({ at: "2026-10-02T04:00:00Z", labels: { language: "other" } });
      await seedPost({ at: "2026-10-02T05:00:00Z", labels: { language: "fr" } });
      await seedPost({ at: "2026-10-02T06:00:00Z", labels: { language: null } });
      const unfiltered = await dist("languages");
      const other = await dist("languages", { ...WEEK, language: "other" });
      expect(other.denominator).toBe(2);
      expect(countOf(other, "other")).toBe(2);
      expect(other.denominator).toBe(countOf(unfiltered, "other"));
      expect((await dist("languages", { ...WEEK, language: "vi,other" })).denominator).toBe(3);
    });

    it("FR-015: viewer 200, non-member denied, invalid query 400", async () => {
      expect((await get("languages")).status).toBe(200);
      expect([403, 404]).toContain((await get("languages", WEEK, "outsider")).status);
      const bad = await get("languages", { from: WEEK.to, to: WEEK.from });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
