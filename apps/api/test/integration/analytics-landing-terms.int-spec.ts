import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { addMember, createPost, createProject, createQuery, createUser } from "../helpers/factories";

/**
 * #261 landing terms × sentiment — FR-149, BR-042, FR-147, BR-016, BR-025, BR-028; TC-DASH-031;
 * docs/01-product/07-metric-definitions.md §4 "Landing terms × sentiment".
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  phrases?: string[];
};
type Row = {
  term: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  dominant: string | null;
  dominantShare: number | null;
};
type Body = { range: { from: string; to: string; timezone: string }; sentimentAnalyzed: number; rows: Row[] };

describe("Analytics landing terms (#261, FR-149)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let reviewer: string;
  const tokens: Record<"viewer" | "outsider", string> = { viewer: "", outsider: "" };
  const WEEK = { from: "2026-10-01T00:00:00+07:00", to: "2026-10-08T00:00:00+07:00" };
  const AT = "2026-10-02T01:00:00Z";

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
    reviewer = (await createUser(prisma)).id;
    const viewer = await createUser(prisma);
    await addMember(prisma, { projectId, userId: viewer.id, role: "viewer" });
    const outsider = await createUser(prisma);
    tokens.viewer = await mintTestJwt({ sub: viewer.id, email: viewer.email });
    tokens.outsider = await mintTestJwt({ sub: outsider.id, email: outsider.email });
  });

  const setTerms = (landingTerms: string[]) =>
    prisma.monitoringProject.update({ where: { id: projectId }, data: { settings: { landingTerms } } });

  async function addAnalysis(postId: string, contentHash: string, l: Labels) {
    const runId = randomUUID();
    const analysisId = randomUUID();
    await prisma.analysisRun.create({
      data: {
        id: runId,
        postId,
        projectId,
        status: "completed",
        trigger: "ingest",
        sourceContentHash: contentHash,
        sourceRevision: 1,
        effectiveVersion: `test-${analysisId}`,
        completedAt: new Date(),
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId,
        projectId,
        relevanceLabel: l.relevance ?? "relevant",
        sentimentLabel: l.sentiment ?? "neutral",
        safetyLevel: "safe",
        languageCode: "vi",
        phrases: { create: (l.phrases ?? []).map((phrase, position) => ({ phrase, position })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: postId },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
  }

  /** Seeds a post matched by q1; `labels: null` → pending (no analysis). */
  async function seedPost(opts: { text: string; at?: string; excluded?: boolean; labels?: Labels | null }) {
    const at = new Date(opts.at ?? AT);
    const post = await createPost(prisma, { projectId, text: opts.text, publishedAt: at, firstSeenAt: at });
    await prisma.postQueryMatch.create({
      data: {
        postId: post.id,
        queryId: q1,
        excludedByTerms: opts.excluded ?? false,
        firstMatchedAt: at,
        lastMatchedAt: at,
      },
    });
    if (opts.labels === null) {
      await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: "pending" } });
    } else {
      await addAnalysis(post.id, post.contentHash, opts.labels ?? {});
    }
    return post;
  }

  const http = (query: Record<string, string> = WEEK, who: keyof typeof tokens = "viewer", pid = projectId) =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${pid}/analytics/landing-terms`)
      .query(query)
      .set("authorization", `Bearer ${tokens[who]}`);
  async function landing(query: Record<string, string> = WEEK): Promise<Body> {
    const res = await http(query);
    expect(res.status).toBe(200);
    return res.body as Body;
  }
  const rowOf = (b: Body, term: string) => b.rows.find((r) => r.term === term);

  it("BR-042: text match is case-insensitive (Vietnamese capitals) and whitespace-collapsed; rows in setting order", async () => {
    await setTerms(["giá vé", "không ai nói"]);
    await seedPost({ text: "GIÁ VÉ quá đắt", labels: { sentiment: "negative" } });
    await seedPost({ text: "giá\n  vé, ổn", labels: { sentiment: "positive" } });
    await seedPost({ text: "giá, vé rẻ", labels: { sentiment: "negative" } });
    const body = await landing();
    expect(body.sentimentAnalyzed).toBe(3);
    expect(body.rows).toEqual([
      { term: "giá vé", positive: 1, neutral: 0, negative: 2, total: 3, dominant: "negative", dominantShare: 2 / 3 },
      { term: "không ai nói", positive: 0, neutral: 0, negative: 0, total: 0, dominant: null, dominantShare: null },
    ]);
  });

  it("BR-042: key phrase of the current analysis matches; old analysis phrases do not; text+phrase counts once", async () => {
    await setTerms(["giá vé"]);
    await seedPost({ text: "không liên quan", labels: { sentiment: "negative", phrases: ["giá vé rẻ"] } });
    const old = await seedPost({ text: "khác", labels: { phrases: ["giá vé"] } });
    await addAnalysis(old.id, old.contentHash, { sentiment: "positive", phrases: ["mới"] });
    await seedPost({ text: "giá vé", labels: { sentiment: "neutral", phrases: ["giá vé"] } });
    expect(rowOf(await landing(), "giá vé")).toMatchObject({ negative: 1, neutral: 1, positive: 0, total: 2 });
  });

  it("BR-016 / BR-025 / A18: irrelevant excluded by default, override applies, pending and excluded-only posts ignored", async () => {
    await setTerms(["app"]);
    await seedPost({ text: "app tốt", labels: { relevance: "irrelevant", sentiment: "positive" } });
    const o = await seedPost({ text: "app lỗi", labels: { sentiment: "negative" } });
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: o.id,
        projectId,
        field: "sentiment",
        overrideValue: { value: "positive" },
        reviewedBy: reviewer,
      },
    });
    await seedPost({ text: "app chờ", labels: null });
    await seedPost({ text: "app loại", excluded: true, labels: { sentiment: "negative" } });
    expect(rowOf(await landing(), "app")).toMatchObject({ positive: 1, negative: 0, total: 1 });
    expect(rowOf(await landing({ ...WEEK, relevance: "relevant,irrelevant" }), "app")?.total).toBe(2);
  });

  it("BR-042: % and _ are literal (no LIKE wildcards)", async () => {
    await setTerms(["50%", "a_b"]);
    await seedPost({ text: "giảm 500 nghìn", labels: {} });
    await seedPost({ text: "axb", labels: {} });
    await seedPost({ text: "giảm 50% hôm nay", labels: {} });
    const body = await landing();
    expect(rowOf(body, "50%")?.total).toBe(1);
    expect(rowOf(body, "a_b")?.total).toBe(0);
  });

  it("BR-028 / FR-149: [from,to) range; default last 30 days in the project timezone", async () => {
    await setTerms(["giá vé", "vé vip"]);
    await seedPost({ text: "giá vé", at: "2026-10-08T00:00:00+07:00", labels: {} });
    expect(rowOf(await landing(), "giá vé")?.total).toBe(0);
    // Default window is relative to the real clock, so it uses its own term (the fixed-date post above may fall in it).
    const day = 86_400_000;
    await seedPost({ text: "vé vip", at: new Date(Date.now() - 20 * day).toISOString(), labels: {} });
    await seedPost({ text: "vé vip", at: new Date(Date.now() - 40 * day).toISOString(), labels: {} });
    const def = await landing({});
    expect(rowOf(def, "vé vip")?.total).toBe(1);
    expect(def.range.timezone).toBe("Asia/Ho_Chi_Minh");
    expect(def.range.from).toMatch(/\+07:00$/);
    const span = new Date(def.range.to).getTime() - new Date(def.range.from).getTime();
    expect(span).toBe(30 * day);
  });

  it("FR-149: no configured terms → rows [] with sentimentAnalyzed", async () => {
    await seedPost({ text: "x", labels: {} });
    expect(await landing()).toMatchObject({ sentimentAnalyzed: 1, rows: [] });
  });

  it("FR-015: viewer 200, outsider denied, bad range 400, unknown project denied", async () => {
    expect((await http()).status).toBe(200);
    expect([403, 404]).toContain((await http(WEEK, "outsider")).status);
    const bad = await http({ from: WEEK.to, to: WEEK.from });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    expect([403, 404]).toContain((await http(WEEK, "viewer", randomUUID())).status);
  });
});
