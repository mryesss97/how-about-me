import { randomUUID } from "node:crypto";
import {
  MentionDetailSchema,
  MentionsPageSchema,
  OverrideSchema,
  OverviewResponseSchema,
} from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { api, createActor, createPost, createProject, createQuery, createTestApp, resetDb } from "../helpers";

type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  intents?: string[];
  topics?: string[];
};

/**
 * T-142 overrides — FR-191/192/193, BR-025, BR-016, BR-003, FR-015, FR-200;
 * TC-REV-001…006, analytics QA A9.
 */
describe("Analysis overrides (T-142)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let queryId: string;
  let analyst: { token: string; userId: string };
  let viewer: string;
  const AT = "2026-10-06T03:00:00Z";
  const range = "from=2026-10-05T00:00:00%2B07:00&to=2026-10-12T00:00:00%2B07:00";
  const base = () => `/projects/${projectId}`;
  const ov = (mid: string) => `${base()}/mentions/${mid}/overrides`;

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

  async function seedPost(labels: Labels | null = {}): Promise<string> {
    const post = await createPost(prisma, { projectId, queryId, publishedAt: new Date(AT), firstSeenAt: new Date(AT) });
    if (labels === null) return post.id;
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
        completedAt: new Date(AT),
      },
    });
    await prisma.postAnalysis.create({
      data: {
        id: analysisId,
        analysisRunId: runId,
        postId: post.id,
        projectId,
        relevanceLabel: labels.relevance ?? "relevant",
        sentimentLabel: labels.sentiment ?? "neutral",
        safetyLevel: "safe",
        languageCode: "vi",
        intents: { create: (labels.intents ?? []).map((label) => ({ label, confidence: 0.8 })) },
        topics: { create: (labels.topics ?? []).map((label) => ({ label, confidence: 0.8 })) },
      },
    });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
    });
    return post.id;
  }

  const post = (mid: string, body: object, token = analyst.token) => api(app, token).post(ov(mid), body);
  async function overview() {
    const res = await api(app, viewer).get(`${base()}/analytics/overview?${range}`);
    expect(res.status).toBe(200);
    return OverviewResponseSchema.parse(res.body);
  }
  async function list(extra = "") {
    const res = await api(app, viewer).get(`${base()}/mentions?${range}${extra}`);
    expect(res.status).toBe(200);
    return MentionsPageSchema.parse(res.body);
  }
  async function dist(path: "intents" | "topics") {
    const res = await api(app, viewer).get(`${base()}/analytics/${path}?${range}`);
    expect(res.status).toBe(200);
    return res.body as { distribution: { label: string; count: number }[] };
  }
  const countOf = (d: { distribution: { label: string; count: number }[] }, l: string) =>
    d.distribution.find((x) => x.label === l)?.count ?? 0;
  const audits = (action: string) => prisma.auditLog.findMany({ where: { action }, orderBy: { createdAt: "asc" } });

  it("TC-REV-001 / FR-191 / FR-200: analyst overrides sentiment → 201, previous AI value kept, audited", async () => {
    const mid = await seedPost({ sentiment: "negative" });
    const res = await post(mid, { field: "sentiment", value: "neutral", reason: "sarcasm" });
    expect(res.status).toBe(201);
    const o = OverrideSchema.parse(res.body);
    expect(o).toMatchObject({ field: "sentiment", previousValue: "negative", value: "neutral", reason: "sarcasm" });
    expect(o.reviewedBy?.id).toBe(analyst.userId);
    const row = await prisma.analysisOverride.findUniqueOrThrow({ where: { id: o.id } });
    expect(row.revokedAt).toBeNull();
    expect(row.overrideValue).toEqual({ value: "neutral" });
    const [a] = await audits("override.created");
    expect(a).toMatchObject({ entityType: "analysis_override", entityId: o.id });
    expect(a?.metadata).toMatchObject({ field: "sentiment", before: "negative", after: "neutral" });
  });

  it("TC-REV-002 / A9 / BR-025: overview negative numerator drops by 1, denominator unchanged", async () => {
    const mid = await seedPost({ sentiment: "negative" });
    await seedPost({ sentiment: "negative" });
    const before = await overview();
    await post(mid, { field: "sentiment", value: "neutral" }).expect(201);
    const after = await overview();
    expect(after.kpis.negativeRate.numerator).toBe(before.kpis.negativeRate.numerator - 1);
    expect(after.kpis.negativeRate.denominator).toBe(before.kpis.negativeRate.denominator);
  });

  it("TC-REV-003: list filters by effective sentiment; hasOverride + source=mixed", async () => {
    const mid = await seedPost({ sentiment: "negative" });
    await post(mid, { field: "sentiment", value: "neutral" }).expect(201);
    const neutral = await list("&sentiment=neutral");
    const item = neutral.items.find((i) => i.id === mid);
    expect(item?.analysis).toMatchObject({ hasOverride: true, source: "mixed", sentiment: { label: "neutral" } });
    expect((await list("&sentiment=negative")).items.map((i) => i.id)).not.toContain(mid);
  });

  it("TC-REV-004 / FR-193: revoke → 204, history kept, effective value back to AI; repeat is a no-op", async () => {
    const mid = await seedPost({ sentiment: "negative" });
    const before = await overview();
    const o = OverrideSchema.parse((await post(mid, { field: "sentiment", value: "neutral" }).expect(201)).body);
    await api(app, analyst.token)
      .delete(`${ov(mid)}/${o.id}`)
      .expect(204);
    const row = await prisma.analysisOverride.findUniqueOrThrow({ where: { id: o.id } });
    expect(row.revokedAt).not.toBeNull();
    expect(row.revokedBy).toBe(analyst.userId);
    expect((await overview()).kpis.negativeRate).toEqual(before.kpis.negativeRate);
    const item = (await list()).items.find((i) => i.id === mid);
    expect(item?.analysis).toMatchObject({ hasOverride: false, source: "ai", sentiment: { label: "negative" } });
    const detail = MentionDetailSchema.parse(
      (await api(app, viewer).get(`${base()}/mentions/${mid}`).expect(200)).body,
    );
    expect(detail.overrides).toHaveLength(1);
    expect(detail.overrides?.[0]).toMatchObject({ id: o.id, revokedBy: { id: analyst.userId } });
    expect(detail.overrides?.[0]?.revokedAt).not.toBeNull();
    await api(app, analyst.token)
      .delete(`${ov(mid)}/${o.id}`)
      .expect(204);
    expect(await audits("override.revoked")).toHaveLength(1);
  });

  it("TC-REV-005 / BR-025 / BR-003: intents override replaces AI labels in list, filters, overview and distributions", async () => {
    const mid = await seedPost({ intents: ["praise"] });
    const before = await overview();
    await post(mid, { field: "intents", value: ["complaint", "complaint"] }).expect(201);
    const item = (await list()).items.find((i) => i.id === mid);
    expect(item?.analysis.intents).toEqual([{ label: "complaint", confidence: null }]);
    expect(item?.analysis.hasOverride).toBe(true);
    expect((await list("&intent=praise")).items.map((i) => i.id)).not.toContain(mid);
    expect((await list("&intent=complaint")).items.map((i) => i.id)).toContain(mid);
    const after = await overview();
    expect(after.kpis.complaintRate.numerator).toBe(before.kpis.complaintRate.numerator + 1);
    const d = await dist("intents");
    expect(countOf(d, "complaint")).toBe(1);
    expect(countOf(d, "praise")).toBe(0);
    // BR-003: AI labels untouched.
    const ai = await prisma.analysisIntent.findMany({ where: { analysis: { postId: mid } } });
    expect(ai.map((i) => i.label)).toEqual(["praise"]);
  });

  it("TC-REV-005 (topics): topics override drives topic distribution and filter", async () => {
    const mid = await seedPost({ topics: ["ticket"] });
    await post(mid, { field: "topics", value: ["payment"] }).expect(201);
    const d = await dist("topics");
    expect(countOf(d, "payment")).toBe(1);
    expect(countOf(d, "ticket")).toBe(0);
    expect((await list("&topic=payment")).items.map((i) => i.id)).toContain(mid);
  });

  it("TC-REV-006 / FR-015: viewer cannot create or revoke (403 FORBIDDEN_ROLE)", async () => {
    const mid = await seedPost();
    const res = await post(mid, { field: "sentiment", value: "neutral" }, viewer);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ROLE");
    const del = await api(app, viewer).delete(`${ov(mid)}/${randomUUID()}`);
    expect(del.status).toBe(403);
    expect(del.body.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("doc 07 §10: second override on same field replaces the first (1 active, 3 audits)", async () => {
    const mid = await seedPost({ sentiment: "negative" });
    await post(mid, { field: "sentiment", value: "neutral" }).expect(201);
    await post(mid, { field: "sentiment", value: "positive" }).expect(201);
    const rows = await prisma.analysisOverride.findMany({ where: { postId: mid } });
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
    expect(rows).toHaveLength(2);
    expect((await audits("override.created")).length + (await audits("override.revoked")).length).toBe(3);
  });

  it("race: concurrent overrides on the same field serialize → exactly one active", async () => {
    const mid = await seedPost();
    const res = await Promise.all([
      post(mid, { field: "sentiment", value: "positive" }),
      post(mid, { field: "sentiment", value: "negative" }),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([201, 201]);
    expect(await prisma.analysisOverride.count({ where: { postId: mid, revokedAt: null } })).toBe(1);
  });

  it.each([
    [{ field: "sentiment", value: "angry" }],
    [{ field: "intents", value: ["not_a_label"] }],
    [{ field: "sentiment", value: "neutral", reason: "x".repeat(501) }],
  ])("400 VALIDATION_ERROR for %j", async (body) => {
    const mid = await seedPost();
    const res = await post(mid, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("400 for non-uuid mentionId; 404 for other project's mention and for override of another post", async () => {
    expect((await post("nope", { field: "sentiment", value: "neutral" })).status).toBe(400);
    const otherProject = (await createProject(prisma)).id;
    const foreign = await createPost(prisma, { projectId: otherProject });
    const r404 = await post(foreign.id, { field: "sentiment", value: "neutral" });
    expect(r404.status).toBe(404);
    expect(r404.body.error.code).toBe("NOT_FOUND");
    const a = await seedPost();
    const b = await seedPost();
    const o = OverrideSchema.parse((await post(a, { field: "sentiment", value: "neutral" }).expect(201)).body);
    expect((await api(app, analyst.token).delete(`${ov(b)}/${o.id}`)).status).toBe(404);
  });

  it("BR-016: relevance override to irrelevant hides post from default list/overview", async () => {
    const mid = await seedPost();
    await post(mid, { field: "relevance", value: "irrelevant" }).expect(201);
    expect((await list()).items.map((i) => i.id)).not.toContain(mid);
    expect((await overview()).kpis.mentionCount.value).toBe(0);
    expect((await list("&relevance=irrelevant")).items.map((i) => i.id)).toContain(mid);
  });

  it("unanalysed post: override allowed (previousValue null), intents show with source=analyst", async () => {
    const mid = await seedPost(null);
    const o = OverrideSchema.parse((await post(mid, { field: "intents", value: ["question"] }).expect(201)).body);
    expect(o.previousValue).toBeNull();
    const detail = MentionDetailSchema.parse(
      (await api(app, viewer).get(`${base()}/mentions/${mid}`).expect(200)).body,
    );
    expect(detail.analysis).toMatchObject({ source: "analyst", hasOverride: true });
    expect(detail.analysis.intents).toEqual([{ label: "question", confidence: null }]);
  });

  it("metric-definitions §6 drill-down equivalence holds with overrides active and after revoke (A9)", async () => {
    const total = async (extra = "") => {
      const res = await api(app, viewer).get(`${base()}/mentions?${range}&count=true${extra}`);
      expect(res.status).toBe(200);
      return MentionsPageSchema.parse(res.body).totalCount;
    };
    const check = async () => {
      const o = await overview();
      const intents = await dist("intents");
      const topics = await dist("topics");
      expect(await total()).toBe(o.kpis.mentionCount.value);
      expect(await total("&sentiment=negative")).toBe(o.kpis.negativeRate.numerator);
      expect(await total("&sentiment=positive")).toBe(o.kpis.positiveRate.numerator);
      expect(await total("&sentiment=positive,neutral,negative")).toBe(o.kpis.negativeRate.denominator);
      expect(await total("&intent=complaint")).toBe(o.kpis.complaintRate.numerator);
      expect(await total("&intent=complaint")).toBe(countOf(intents, "complaint"));
      expect(await total("&intent=praise")).toBe(countOf(intents, "praise"));
      expect(await total("&topic=payment")).toBe(countOf(topics, "payment"));
      expect(await total("&topic=ticket")).toBe(countOf(topics, "ticket"));
      return o;
    };
    await seedPost({ sentiment: "negative", intents: ["complaint"], topics: ["ticket"] });
    const p2 = await seedPost({ sentiment: "negative", topics: ["ticket"] });
    const p3 = await seedPost({ sentiment: "neutral", intents: ["praise"] });
    const p4 = await seedPost({ sentiment: "positive", topics: ["ticket"] });
    const p5 = await seedPost({ sentiment: "negative", intents: ["complaint"] });
    const before = await check();

    const created: [string, string][] = [];
    for (const [mid, body] of [
      [p2, { field: "sentiment", value: "neutral" }],
      [p3, { field: "intents", value: ["complaint"] }],
      [p4, { field: "topics", value: ["payment"] }],
      [p5, { field: "relevance", value: "irrelevant" }],
    ] as const) {
      created.push([mid, OverrideSchema.parse((await post(mid, body).expect(201)).body).id]);
    }
    const during = await check();
    expect(during.kpis.mentionCount.value).toBe(before.kpis.mentionCount.value - 1);
    expect(during.kpis.negativeRate.numerator).toBe(before.kpis.negativeRate.numerator - 2);
    expect(during.kpis.complaintRate.numerator).toBe(before.kpis.complaintRate.numerator);

    for (const [mid, oid] of created) {
      await api(app, analyst.token)
        .delete(`${ov(mid)}/${oid}`)
        .expect(204);
    }
    const after = await check();
    expect(after.kpis).toEqual(before.kpis);
    expect(after.coverage).toEqual(before.coverage);
  });

  it("safety net: the active partial unique index rejects a second active row for the same (post, field)", async () => {
    const mid = await seedPost();
    const row = (id: string) => ({
      id,
      postId: mid,
      projectId,
      field: "sentiment" as const,
      overrideValue: { value: "neutral" },
      reviewedBy: analyst.userId,
    });
    await prisma.analysisOverride.create({ data: row(randomUUID()) });
    await expect(prisma.analysisOverride.create({ data: row(randomUUID()) })).rejects.toMatchObject({ code: "P2002" });
  });

  it("views: effective_post_intents/topics exist; has_override true with only an intents override", async () => {
    const mid = await seedPost({ intents: ["praise"] });
    await post(mid, { field: "intents", value: [] }).expect(201);
    const [e] = await prisma.$queryRaw<{ has_override: boolean }[]>(
      Prisma.sql`SELECT has_override FROM effective_post_analysis WHERE post_id = ${mid}::uuid`,
    );
    expect(e?.has_override).toBe(true);
    const labels = await prisma.$queryRaw<unknown[]>(
      Prisma.sql`SELECT label FROM effective_post_intents WHERE post_id = ${mid}::uuid
                 UNION ALL SELECT label FROM effective_post_topics WHERE post_id = ${mid}::uuid`,
    );
    expect(labels).toEqual([]);
  });
});
