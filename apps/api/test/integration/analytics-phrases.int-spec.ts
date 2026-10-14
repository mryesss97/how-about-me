import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { addMember, createPost, createProject, createQuery, createUser } from "../helpers/factories";

/**
 * #223 phrase × sentiment — FR-148, FR-140, FR-142, FR-147, BR-016, BR-025, BR-028, BR-041; TC-DASH-029;
 * docs/01-product/07-metric-definitions.md §4 "Phrase × sentiment".
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  phrases?: string[];
};
type Row = {
  phrase: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  negativeShare: number | null;
};

describe("Analytics phrase × sentiment (#223, FR-148)", () => {
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

  /** Seeds a post; with `labels`, one completed analysis (with phrases) becomes current; `null` → pending. */
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
        phrases: { create: (l.phrases ?? []).map((phrase, position) => ({ phrase, position })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  /** Appends a newer analysis (BR-026) and makes it current; the old one keeps its phrases. */
  async function reanalyse(postId: string, labels: Labels) {
    const post = await prisma.socialPost.findUniqueOrThrow({ where: { id: postId } });
    const runId = randomUUID();
    const analysisId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId,
        projectId,
        status: "completed",
        trigger: "manual",
        sourceContentHash: post.contentHash,
        sourceRevision: 1,
        effectiveVersion: "test-v2",
        completedAt: now,
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId,
        projectId,
        relevanceLabel: labels.relevance ?? "relevant",
        sentimentLabel: labels.sentiment ?? "neutral",
        safetyLevel: "safe",
        languageCode: "vi",
        phrases: { create: (labels.phrases ?? []).map((phrase, position) => ({ phrase, position })) },
      },
    });
    await prisma.socialPost.update({ where: { id: postId }, data: { currentAnalysisId: analysisId } });
  }

  const http = (path: string, query: Record<string, string> = WEEK, who: keyof typeof tokens = "viewer") =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/${path}`)
      .query(query)
      .set("authorization", `Bearer ${tokens[who]}`);

  type Body = {
    sentimentAnalyzed: number;
    phraseAnalyzed: number;
    totalPhrases: number;
    minMentions: number;
    limit: number;
    rows: Row[];
  };
  async function phrases(query: Record<string, string> = WEEK): Promise<Body> {
    const res = await http("analytics/phrases", query);
    expect(res.status).toBe(200);
    return res.body as Body;
  }
  const rowOf = (rows: Row[], phrase: string) => rows.find((r) => r.phrase === phrase);
  const ONE = { ...WEEK, minMentions: "1" };

  it("TC-DASH-029 / FR-148: cells, totals, negativeShare, scalars; multi-phrase post counted per row", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", phrases: ["giá vé", "app lỗi"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "positive", phrases: ["giá vé"] } });
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "negative", phrases: ["giá vé"] } });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { sentiment: "neutral" } }); // v1-style: no phrases
    const body = await phrases(ONE);
    expect(body).toMatchObject({ sentimentAnalyzed: 4, phraseAnalyzed: 3, totalPhrases: 2, minMentions: 1, limit: 30 });
    expect(body.rows).toEqual([
      { phrase: "giá vé", positive: 1, neutral: 0, negative: 2, total: 3, negativeShare: 2 / 3 },
      { phrase: "app lỗi", positive: 0, neutral: 0, negative: 1, total: 1, negativeShare: 1 },
    ]);
  });

  it("FR-148: default minMentions=2 and limit=30; totalPhrases counts before the cut; ties by phrase", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { phrases: ["b", "a", "c"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { phrases: ["b", "a", "d"] } });
    const def = await phrases();
    expect(def).toMatchObject({ minMentions: 2, limit: 30, totalPhrases: 2 });
    expect(def.rows.map((r) => r.phrase)).toEqual(["a", "b"]);
    const cut = await phrases({ ...WEEK, minMentions: "1", limit: "1" });
    expect(cut.totalPhrases).toBe(4);
    expect(cut.rows.map((r) => r.phrase)).toEqual(["a"]);
  });

  it("FR-148 / #251: project setting phraseMinMentions is the default; query param overrides; response reports it", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { phrases: ["b", "a", "c"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { phrases: ["b", "a", "d"] } });
    await prisma.monitoringProject.update({ where: { id: projectId }, data: { settings: { phraseMinMentions: 1 } } });
    const def = await phrases();
    expect(def).toMatchObject({ minMentions: 1, totalPhrases: 4 });
    expect(def.rows).toHaveLength(4);
    const override = await phrases({ ...WEEK, minMentions: "2" });
    expect(override).toMatchObject({ minMentions: 2, totalPhrases: 2 });
  });

  it("FR-032 / #251: malformed phraseMinMentions setting falls back to 2 (no 500)", async () => {
    await prisma.monitoringProject.update({ where: { id: projectId }, data: { settings: { phraseMinMentions: "x" } } });
    expect(await phrases()).toMatchObject({ minMentions: 2 });
  });

  it("only phrases of the current analysis count (BR-026 old analyses keep theirs)", async () => {
    const p = await seedPost({ at: "2026-10-02T01:00:00Z", labels: { phrases: ["cũ"] } });
    await reanalyse(p, { sentiment: "negative", phrases: ["mới"] });
    const body = await phrases(ONE);
    expect(body.rows.map((r) => r.phrase)).toEqual(["mới"]);
    expect(await prisma.analysisPhrase.count({ where: { phrase: "cũ" } })).toBe(1);
  });

  it("BR-025: sentiment override applies to phrase rows", async () => {
    const p = await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", phrases: ["giá vé"] } });
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: p,
        projectId,
        field: "sentiment",
        overrideValue: { value: "positive" },
        reviewedBy: reviewer,
      },
    });
    expect(rowOf((await phrases(ONE)).rows, "giá vé")).toMatchObject({ positive: 1, negative: 0 });
  });

  it("FR-147: a post matched by two queries counts once", async () => {
    await seedPost({
      at: "2026-10-02T01:00:00Z",
      matches: { [q1]: false, [q2]: false },
      labels: { sentiment: "negative", phrases: ["giá vé"] },
    });
    expect(rowOf((await phrases(ONE)).rows, "giá vé")).toMatchObject({ negative: 1, total: 1 });
  });

  it("BR-016: irrelevant excluded by default; pending posts not counted", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { phrases: ["giá vé"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { relevance: "irrelevant", phrases: ["giá vé"] } });
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: null });
    expect(rowOf((await phrases(ONE)).rows, "giá vé")?.total).toBe(1);
    expect(rowOf((await phrases({ ...ONE, relevance: "relevant,irrelevant" })).rows, "giá vé")?.total).toBe(2);
  });

  it("BR-028: range is [from,to) in Asia/Ho_Chi_Minh", async () => {
    await seedPost({ at: "2026-10-01T00:00:00+07:00", labels: { phrases: ["giá vé"] } });
    await seedPost({ at: "2026-10-08T00:00:00+07:00", labels: { phrases: ["giá vé"] } });
    expect(rowOf((await phrases(ONE)).rows, "giá vé")?.total).toBe(1);
  });

  it("BR-041 / FR-142: phrase filter normalised; drill-down /mentions?phrase&sentiment equals the cell", async () => {
    await seedPost({ at: "2026-10-02T01:00:00Z", labels: { sentiment: "negative", phrases: ["giá vé", "app lỗi"] } });
    await seedPost({ at: "2026-10-02T02:00:00Z", labels: { sentiment: "negative", phrases: ["giá vé"] } });
    await seedPost({ at: "2026-10-02T03:00:00Z", labels: { sentiment: "positive", phrases: ["giá vé"] } });
    const row = rowOf((await phrases(ONE)).rows, "giá vé");
    const neg = await http("mentions", { ...WEEK, phrase: "Giá Vé", sentiment: "negative", count: "true" });
    expect(neg.status).toBe(200);
    expect(neg.body.totalCount).toBe(row?.negative);
    const all = await http("mentions", { ...WEEK, phrase: "giá vé", count: "true" });
    expect(all.body.totalCount).toBe(row?.total);
    // phrase filter also narrows the phrases endpoint itself (posts having the phrase).
    const filtered = await phrases({ ...ONE, phrase: "app lỗi" });
    expect(filtered.rows.map((r) => r.phrase).sort()).toEqual(["app lỗi", "giá vé"]);
    expect(rowOf(filtered.rows, "giá vé")?.total).toBe(1);
  });

  it("FR-140: no data → empty rows and zero scalars", async () => {
    expect(await phrases()).toEqual({
      sentimentAnalyzed: 0,
      phraseAnalyzed: 0,
      totalPhrases: 0,
      minMentions: 2,
      limit: 30,
      rows: [],
    });
  });

  it("FR-015: viewer 200, non-member denied, limit=0 / bad phrase 400, unknown project 404", async () => {
    expect((await http("analytics/phrases")).status).toBe(200);
    expect([403, 404]).toContain((await http("analytics/phrases", WEEK, "outsider")).status);
    const bads: Record<string, string>[] = [{ limit: "0" }, { minMentions: "0" }, { phrase: "🔥" }];
    for (const q of bads) {
      const bad = await http("analytics/phrases", { ...WEEK, ...q });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    }
    const missing = await request(app.getHttpServer())
      .get(`/api/v1/projects/${randomUUID()}/analytics/phrases`)
      .query(WEEK)
      .set("authorization", `Bearer ${tokens.viewer}`);
    expect([403, 404]).toContain(missing.status);
  });
});
