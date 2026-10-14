import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { addMember, createPost, createProject, createQuery, createUser } from "../helpers/factories";

/** #273 term filter — BR-042 matching applied to the base set `B` (analytics + mentions); BR-016, BR-025, FR-147. */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative" | null;
  topics?: ("ticket" | "venue")[];
  phrases?: string[];
};
type Row = { term: string; total: number };

describe("Term filter (#273, BR-042)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  const tokens: Record<"viewer" | "outsider" | "analyst", string> = { viewer: "", outsider: "", analyst: "" };
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
    const viewer = await createUser(prisma);
    await addMember(prisma, { projectId, userId: viewer.id, role: "viewer" });
    const analyst = await createUser(prisma);
    await addMember(prisma, { projectId, userId: analyst.id, role: "analyst" });
    tokens.analyst = await mintTestJwt({ sub: analyst.id, email: analyst.email });
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
        sentimentLabel: l.sentiment === undefined ? "neutral" : l.sentiment,
        safetyLevel: "safe",
        languageCode: "vi",
        topics: { create: (l.topics ?? []).map((label) => ({ label })) },
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

  const http = (path: string, query: Record<string, string> = {}, who: keyof typeof tokens = "viewer") =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/${path}`)
      .query({ ...WEEK, ...query })
      .set("authorization", `Bearer ${tokens[who]}`);
  async function mentionCount(query: Record<string, string> = {}): Promise<number> {
    const res = await http("analytics/overview", query);
    expect(res.status).toBe(200);
    return (res.body as { kpis: { mentionCount: { value: number } } }).kpis.mentionCount.value;
  }
  async function mentionIds(query: Record<string, string> = {}): Promise<string[]> {
    const res = await http("mentions", query);
    expect(res.status).toBe(200);
    return (res.body as { items: { id: string }[] }).items.map((x) => x.id).sort();
  }

  it("BR-042: text or current-analysis phrase match; text+phrase counts once; old phrases ignored", async () => {
    const a = await seedPost({ text: "GIÁ VÉ quá đắt", labels: {} });
    const b = await seedPost({ text: "không liên quan", labels: { phrases: ["giá vé rẻ"] } });
    const c = await seedPost({ text: "giá vé", labels: { phrases: ["giá vé"] } });
    const old = await seedPost({ text: "khác", labels: { phrases: ["giá vé"] } });
    await addAnalysis(old.id, old.contentHash, { phrases: ["mới"] });
    await seedPost({ text: "chuyện khác", labels: {} });
    expect(await mentionCount()).toBe(5);
    expect(await mentionCount({ term: "giá vé" })).toBe(3);
    expect(await mentionIds({ term: "giá vé" })).toEqual([a.id, b.id, c.id].sort());
  });

  it("BR-041 normalisation: casing/commas/whitespace equal; accents significant", async () => {
    await seedPost({ text: "Giá,  vé tăng", labels: {} });
    expect(await mentionCount({ term: "GIÁ Vé" })).toBe(1);
    expect(await mentionCount({ term: "gia ve" })).toBe(0);
  });

  it("BR-042: % and _ are literal", async () => {
    await seedPost({ text: "giảm 500k", labels: {} });
    await seedPost({ text: "acb", labels: {} });
    expect(await mentionCount({ term: "50%" })).toBe(0);
    expect(await mentionCount({ term: "a_b" })).toBe(0);
  });

  it("combines with sentiment, queryIds and topics distribution", async () => {
    await seedPost({ text: "giá vé", labels: { sentiment: "negative", topics: ["ticket"] } });
    await seedPost({ text: "giá vé", labels: { sentiment: "positive", topics: ["venue"] } });
    await seedPost({ text: "khác", labels: { sentiment: "negative", topics: ["ticket"] } });
    expect(await mentionCount({ term: "giá vé", sentiment: "negative", queryIds: q1 })).toBe(1);
    expect(await mentionCount({ term: "giá vé", queryIds: randomUUID() })).toBe(0);
    const res = await http("analytics/topics", { term: "giá vé" });
    expect(res.status).toBe(200);
    const dist = (res.body as { distribution: { label: string; count: number }[] }).distribution;
    expect(dist.find((x) => x.label === "ticket")?.count).toBe(1);
    expect(dist.find((x) => x.label === "venue")?.count).toBe(1);
  });

  it("invariant: overview mentionCount(term) = landing total + matched posts without sentiment; landing ignores term", async () => {
    await setTerms(["giá vé", "app"]);
    await seedPost({ text: "giá vé", labels: { sentiment: "negative" } });
    await seedPost({ text: "x", labels: { sentiment: "positive", phrases: ["giá vé"] } });
    await seedPost({ text: "giá vé", labels: { sentiment: null } });
    await seedPost({ text: "giá vé", labels: null });
    await seedPost({ text: "giá vé", labels: { relevance: "irrelevant", sentiment: "neutral" } });
    await seedPost({ text: "app", labels: {} });
    const landing = await http("analytics/landing-terms", { term: "giá vé" });
    expect(landing.status).toBe(200);
    const rows = (landing.body as { rows: Row[] }).rows;
    expect(rows.map((r) => r.term)).toEqual(["giá vé", "app"]);
    expect(rows[0]?.total).toBe(2);
    expect(rows[1]?.total).toBe(1);
    expect(await mentionCount({ term: "giá vé" })).toBe((rows[0]?.total ?? 0) + 1);
    expect(await mentionCount({ term: "app" })).toBe(rows[1]?.total);
  });

  it("mentions export honours term", async () => {
    await seedPost({ text: "giá vé tăng", labels: {} });
    await seedPost({ text: "khác", labels: {} });
    const res = await http("mentions/export.csv", { term: "giá vé" }, "analyst")
      .buffer(true)
      .parse((r, cb) => {
        let s = "";
        r.setEncoding("utf8");
        r.on("data", (c: string) => (s += c));
        r.on("end", () => cb(null, s));
      });
    expect(res.status).toBe(200);
    const csv = res.body as string;
    expect(csv).toContain("giá vé tăng");
    expect(csv).not.toContain("khác");
  });

  it.each(["", "!!!", "a".repeat(61)])("term=%j → 400 VALIDATION_ERROR", async (term) => {
    for (const path of ["analytics/overview", "mentions"]) {
      const res = await http(path, { term });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
