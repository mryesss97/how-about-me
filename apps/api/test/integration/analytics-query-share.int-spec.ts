import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { addMember, createPost, createProject, createQuery, createUser } from "../helpers/factories";

/**
 * T-150 keyword (query) share — FR-145, FR-147, FR-140, FR-142, BR-010, BR-016; QA A2/A14/A18; TC-DASH-027;
 * docs/01-product/07-metric-definitions.md §4.
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
type Item = { queryId: string; displayName: string; count: number; share: number | null };
type Share = { denominator: number; distribution: Item[]; note: string };

describe("Analytics query-share (T-150, FR-145)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let q2: string;
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
    q1 = (await createQuery(prisma, { projectId, displayName: "alpha" })).id;
    q2 = (await createQuery(prisma, { projectId, displayName: "beta" })).id;
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

  const http = (path: string, query: Record<string, string>, who: keyof typeof tokens = "viewer") =>
    request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/${path}`)
      .query(query)
      .set("authorization", `Bearer ${tokens[who]}`);

  async function share(query: Record<string, string> = WEEK): Promise<Share> {
    const res = await http("analytics/query-share", query);
    expect(res.status).toBe(200);
    return res.body as Share;
  }
  const byId = (d: Share, id: string) => d.distribution.find((x) => x.queryId === id);

  it("A2 / TC-DASH-027 / FR-147: overlapping post counts once in denominator, once per query", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: false, [q2]: false } });
    const d = await share();
    expect(d.note).toBe("overlapping");
    expect(d.denominator).toBe(1);
    expect(byId(d, q1)).toMatchObject({ count: 1, share: 1, displayName: "alpha" });
    expect(byId(d, q2)).toMatchObject({ count: 1, share: 1 });
    const overview = await http("analytics/overview", WEEK);
    expect(overview.body.kpis.mentionCount.value).toBe(d.denominator);
  });

  it("A18: excluded_by_terms match never counts for that query", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: true, [q2]: false } });
    const d = await share();
    expect(d.denominator).toBe(1);
    expect(byId(d, q1)?.count).toBe(0);
    expect(byId(d, q2)?.count).toBe(1);
  });

  it("BR-016: irrelevant excluded by default, included with relevance=irrelevant", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z" });
    await seedPost({ at: "2026-10-02T04:00:00Z", labels: { relevance: "irrelevant" } });
    expect(byId(await share(), q1)?.count).toBe(1);
    const all = await share({ ...WEEK, relevance: "relevant,irrelevant" });
    expect(all.denominator).toBe(2);
    expect(byId(all, q1)?.count).toBe(2);
  });

  it("queryIds filter limits both the list and the denominator", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: false, [q2]: false } });
    await seedPost({ at: "2026-10-02T04:00:00Z", matches: { [q2]: false } });
    const d = await share({ ...WEEK, queryIds: q1 });
    expect(d.denominator).toBe(1);
    expect(d.distribution.map((x) => x.queryId)).toEqual([q1]);
  });

  it("BR-010: soft-deleted listed only with counts; disabled queries listed with 0", async () => {
    const deletedWith = (await createQuery(prisma, { projectId, displayName: "gone-1", deletedAt: now })).id;
    const deletedEmpty = (await createQuery(prisma, { projectId, displayName: "gone-2", deletedAt: now })).id;
    const disabled = (await createQuery(prisma, { projectId, displayName: "off", enabled: false })).id;
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [deletedWith]: false } });
    const d = await share();
    expect(byId(d, deletedWith)?.count).toBe(1);
    expect(byId(d, deletedEmpty)).toBeUndefined();
    expect(byId(d, disabled)?.count).toBe(0);
    // Explicit queryIds → exactly those queries, even soft-deleted with 0.
    const picked = await share({ ...WEEK, queryIds: deletedEmpty });
    expect(picked.distribution.map((x) => x.queryId)).toEqual([deletedEmpty]);
  });

  it("sorts by count desc, ties by displayName asc", async () => {
    const q0 = (await createQuery(prisma, { projectId, displayName: "aaa" })).id;
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q2]: false } });
    const d = await share();
    expect(d.distribution.map((x) => x.queryId)).toEqual([q2, q0, q1]);
  });

  it("range is [from,to): a post exactly at `to` is excluded", async () => {
    await seedPost({ at: "2026-10-01T00:00:00+07:00" });
    await seedPost({ at: "2026-10-08T00:00:00+07:00" });
    expect(byId(await share(), q1)?.count).toBe(1);
  });

  it("FR-140: no posts → denominator 0, every query count 0 / share null", async () => {
    const d = await share();
    expect(d.denominator).toBe(0);
    expect(d.distribution).toHaveLength(2);
    expect(d.distribution.every((x) => x.count === 0 && x.share === null)).toBe(true);
  });

  it("A14 / FR-142: drill-down /mentions?queryIds=q totalCount equals the query count", async () => {
    await seedPost({ at: "2026-10-02T03:00:00Z", matches: { [q1]: false, [q2]: false } });
    await seedPost({ at: "2026-10-02T04:00:00Z", matches: { [q1]: false } });
    await seedPost({ at: "2026-10-02T05:00:00Z", matches: { [q1]: true, [q2]: false } });
    const d = await share();
    const list = await http("mentions", { ...WEEK, queryIds: q1, count: "true" });
    expect(list.status).toBe(200);
    expect(list.body.totalCount).toBe(byId(d, q1)?.count);
    expect(byId(d, q1)?.count).toBe(2);
  });

  it("FR-015: viewer 200, non-member denied, invalid range 400, foreign query ids ignored", async () => {
    expect((await http("analytics/query-share", WEEK)).status).toBe(200);
    expect([403, 404]).toContain((await http("analytics/query-share", WEEK, "outsider")).status);
    const bad = await http("analytics/query-share", { from: WEEK.to, to: WEEK.from });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    const other = await createProject(prisma);
    const foreign = (await createQuery(prisma, { projectId: other.id })).id;
    const d = await share({ ...WEEK, queryIds: `${q1},${foreign}` });
    expect(d.distribution.map((x) => x.queryId)).toEqual([q1]);
  });
});
