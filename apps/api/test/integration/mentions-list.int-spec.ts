import { randomUUID } from "node:crypto";
import { MentionsListQuerySchema, MentionsPageSchema } from "@how-about-me/contracts";
import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../src/database/prisma.service";
import { withBase } from "../../src/modules/analytics/analytics-filters";
import { encodeSortCursor } from "../../src/common/pagination/cursor";
import { resolveMentionsScope } from "../../src/modules/mentions/mentions-query";
import { MentionsRepository } from "../../src/modules/mentions/mentions.repository";
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
 * T-095 GET …/mentions against real Postgres — FR-150/152/153/161, BR-002, BR-007, BR-010, BR-016, BR-017,
 * BR-021, BR-025; TC-MEN-001/003/004/005/006/007; drill-down equivalence (metric-definitions §6).
 */
type Labels = {
  relevance?: "relevant" | "uncertain" | "irrelevant";
  sentiment?: "positive" | "neutral" | "negative";
  safety?: "safe" | "sensitive" | "severe";
  language?: string;
  relConf?: number;
  overall?: number | null;
  intents?: [string, number][];
  topics?: string[];
};

const WEEK = { from: "2026-10-01T00:00:00Z", to: "2026-10-08T00:00:00Z" };
const qs = (o: Record<string, string | number>) =>
  new URLSearchParams({ ...WEEK, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) }).toString();

describe("Mentions list (T-095)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let q1: string;
  let q2: string;
  let token: string;
  let seq = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    seq = 0;
    projectId = (await createProject(prisma)).id;
    q1 = (await createQuery(prisma, { projectId })).id;
    q2 = (await createQuery(prisma, { projectId })).id;
    token = (await createActor(prisma, { projectId, role: "viewer" })).token;
  });

  async function seedPost(opts: {
    at?: string;
    text?: string;
    matches?: Record<string, boolean>;
    labels?: Labels | null;
    runStatus?: "pending" | "processing" | "failed";
    errorCode?: string;
    project?: string;
  }) {
    const pid = opts.project ?? projectId;
    seq += 1;
    const at = new Date(opts.at ?? `2026-10-02T00:00:${String(seq % 60).padStart(2, "0")}Z`);
    const post = await createPost(prisma, {
      projectId: pid,
      publishedAt: at,
      firstSeenAt: at,
      text: opts.text ?? `post ${seq}`,
    });
    for (const [queryId, excludedByTerms] of Object.entries(opts.matches ?? { [q1]: false })) {
      await prisma.postQueryMatch.create({
        data: { postId: post.id, queryId, excludedByTerms, firstMatchedAt: at, lastMatchedAt: at },
      });
    }
    if (opts.labels !== null) {
      const l = {
        relevance: "relevant",
        sentiment: "neutral",
        safety: "safe",
        language: "vi",
        relConf: 0.9,
        ...opts.labels,
      } as const;
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
          effectiveVersion: "v1",
          completedAt: at,
          createdAt: at,
        },
      });
      await prisma.postAnalysis.create({
        data: {
          id: analysisId,
          analysisRunId: runId,
          postId: post.id,
          projectId: pid,
          relevanceLabel: l.relevance,
          relevanceConfidence: l.relConf,
          sentimentLabel: l.sentiment,
          safetyLevel: l.safety,
          languageCode: l.language,
          overallModelConfidence: opts.labels?.overall === undefined ? 0.9 : opts.labels.overall,
          intents: { create: (l.intents ?? []).map(([label, confidence]) => ({ label, confidence })) },
          topics: { create: (l.topics ?? []).map((label) => ({ label })) },
        },
      });
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { currentAnalysisId: analysisId, latestRunStatus: "completed" },
      });
    }
    if (opts.runStatus) {
      await prisma.analysisRun.create({
        data: {
          id: randomUUID(),
          postId: post.id,
          projectId: pid,
          status: opts.runStatus,
          trigger: "manual",
          sourceContentHash: post.contentHash,
          sourceRevision: 1,
          effectiveVersion: "v2",
          errorCode: opts.errorCode ?? null,
          // Newer than the completed run without relying on the Node clock vs DB now() (#189).
          createdAt: new Date(at.getTime() + 1000),
        },
      });
      await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: opts.runStatus } });
    } else if (opts.labels === null) {
      await prisma.socialPost.update({ where: { id: post.id }, data: { latestRunStatus: "pending" } });
    }
    return post.id;
  }

  const get = (query: Record<string, string | number> = {}, t = token) =>
    api(app, t).get(`/projects/${projectId}/mentions?${qs(query)}`);

  async function all(query: Record<string, string | number>): Promise<string[]> {
    const out: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 50; i += 1) {
      const res = await get(cursor ? { ...query, cursor } : query).expect(200);
      const page = MentionsPageSchema.parse(res.body);
      out.push(...page.items.map((x) => x.id));
      cursor = page.nextCursor;
      if (!cursor) break;
      expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    }
    return out;
  }

  it("TC-MEN-001: default page = 25 newest relevant, count=true totals the set (BR-016)", async () => {
    for (let i = 0; i < 30; i += 1) await seedPost({});
    for (let i = 0; i < 3; i += 1) await seedPost({ labels: { relevance: "irrelevant" } });
    await seedPost({ labels: null });
    await seedPost({ labels: null });
    const res = await get({ count: "true" }).expect(200);
    const page = MentionsPageSchema.parse(res.body);
    expect(page.items).toHaveLength(25);
    expect(page.totalCount).toBe(30);
    const times = page.items.map((x) => x.publishedAt);
    expect([...times].sort().reverse()).toEqual(times);
    expect(page.items.every((x) => x.analysis.relevance?.label === "relevant")).toBe(true);
    expect((await get({}).expect(200)).body).not.toHaveProperty("totalCount");
  });

  it("TC-MEN-003/007: every sort pages through all posts once, ties included", async () => {
    const tie = "2026-10-03T00:00:00.123456Z";
    const ids: string[] = [];
    const safeties = ["safe", "sensitive", "severe"] as const;
    for (let i = 0; i < 23; i += 1) {
      ids.push(
        await seedPost({
          at: i % 3 === 0 ? tie : undefined,
          labels: {
            safety: safeties[i % 3],
            overall: i % 5 === 0 ? null : (i % 4) / 10,
            relevance: i % 2 ? "relevant" : "uncertain",
            relConf: (i % 3) / 10,
          },
        }),
      );
    }
    for (const sort of ["newest", "oldest", "safety_desc", "confidence_asc", "relevance_desc"]) {
      const got = await all({ sort, limit: 10, relevance: "relevant,uncertain" });
      expect(new Set(got).size).toBe(got.length);
      expect([...got].sort()).toEqual([...ids].sort());
    }
  });

  it("TC-MEN-007: sort orders (safety_desc, confidence_asc nulls last, oldest)", async () => {
    const safe = await seedPost({ at: "2026-10-05T00:00:00Z", labels: { safety: "safe", overall: 0.5 } });
    const severe = await seedPost({ at: "2026-10-02T00:00:00Z", labels: { safety: "severe", overall: null } });
    const sens = await seedPost({ at: "2026-10-03T00:00:00Z", labels: { safety: "sensitive", overall: 0.2 } });
    const ids = async (sort: string) =>
      ((await get({ sort }).expect(200)).body as { items: { id: string }[] }).items.map((x) => x.id);
    expect(await ids("safety_desc")).toEqual([severe, sens, safe]);
    expect(await ids("confidence_asc")).toEqual([sens, safe, severe]);
    expect(await ids("oldest")).toEqual([severe, sens, safe]);
    expect(await ids("newest")).toEqual([safe, sens, severe]);
  });

  it("TC-MEN-004: limit/cursor validation", async () => {
    await seedPost({});
    await seedPost({});
    const bad = await get({ limit: 500 }).expect(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
    expect(bad.body.error.requestId).toBeTruthy();
    await get({ limit: 100 }).expect(200);
    expect((await get({ cursor: "garbage" }).expect(400)).body.error.code).toBe("VALIDATION_ERROR");
    const first = await get({ limit: 1 }).expect(200);
    const cursor = (first.body as { nextCursor: string }).nextCursor;
    expect(cursor).toBeTruthy();
    expect((await get({ cursor, sort: "oldest" }).expect(400)).body.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-MEN-004b (#195): tampered cursor keys per sort → 400, never 500", async () => {
    await seedPost({});
    const T = "2026-10-01T00:00:00.123456Z";
    const cases: [string, (string | number)[]][] = [
      ["newest", ["abc"]],
      ["newest", ["2026-10-01 00:00:00.123456+00"]],
      ["oldest", [123]],
      ["safety_desc", ["x", T]],
      ["safety_desc", ["99999999999", T]],
      ["confidence_asc", ["NaN", T]],
      ["confidence_asc", ["1e400", T]],
      ["relevance_desc", ["3", "", T]],
      ["relevance_desc", ["1.5", "0.5", T]],
    ];
    for (const [sort, keys] of cases) {
      const cursor = encodeSortCursor({ sort, keys, id: randomUUID() });
      const res = await get({ sort, cursor }).expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.requestId).toBeTruthy();
    }
  });

  it("TC-MEN-004c (#195): µs timestamp keys page without dupes/gaps inside one millisecond", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) ids.push(await seedPost({ labels: { relConf: 0.5, overall: 0.5 } }));
    for (const [i, id] of ids.entries()) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE social_posts SET published_at = ${`2026-10-02T00:00:00.12345${i}Z`}::timestamptz WHERE id = ${id}::uuid`,
      );
    }
    for (const sort of ["newest", "confidence_asc", "relevance_desc"]) {
      const got = await all({ sort, limit: 1 });
      expect([...got].sort()).toEqual([...ids].sort());
    }
  });

  it("TC-MEN-005: filters, DISTINCT posts (BR-002), excluded matches (BR-007), drill-down equivalence", async () => {
    const both = await seedPost({
      matches: { [q1]: false, [q2]: false },
      labels: { sentiment: "negative", intents: [["complaint", 0.9]] },
    });
    await seedPost({ matches: { [q2]: true } }); // only excluded → never listed
    const neg2 = await seedPost({
      matches: { [q2]: false },
      labels: { sentiment: "negative", safety: "severe", language: "en", topics: ["ticket"] },
    });
    const irr = await seedPost({ labels: { relevance: "irrelevant" } });
    const ids = async (f: Record<string, string>) =>
      ((await get(f).expect(200)).body as { items: { id: string }[] }).items.map((x) => x.id).sort();
    expect(await ids({ queryIds: `${q1},${q2}` })).toEqual([both, neg2].sort());
    expect(await ids({ queryIds: q2 })).toEqual([both, neg2].sort());
    expect(await ids({ sentiment: "negative" })).toEqual([both, neg2].sort());
    expect(await ids({ safety: "severe" })).toEqual([neg2]);
    expect(await ids({ language: "en" })).toEqual([neg2]);
    expect(await ids({ intent: "complaint" })).toEqual([both]);
    expect(await ids({ topic: "ticket" })).toEqual([neg2]);
    expect(await ids({ relevance: "irrelevant" })).toEqual([irr]);
    expect(await ids({ analysisStatus: "failed" })).toEqual([]);
    expect(await ids({ from: "2026-10-05T00:00:00Z" })).toEqual([]);

    const filters: Record<string, string>[] = [
      {},
      { sentiment: "negative" },
      { queryIds: q2 },
      { relevance: "relevant,irrelevant" },
    ];
    for (const f of filters) {
      const res = await get({ ...f, count: "true" }).expect(200);
      const { scope } = resolveMentionsScope(MentionsListQuerySchema.parse({ ...WEEK, ...f }), projectId);
      const rows = await prisma.$queryRaw<{ n: number }[]>(
        withBase(scope, Prisma.sql`SELECT count(*)::int AS n FROM base`),
      );
      expect(res.body.totalCount).toBe(rows[0]?.n);
    }
  });

  it("BR-016 exception (#328): status-only filters keep NULL-relevance posts; analytics unchanged", async () => {
    const pendingNull = await seedPost({ labels: null });
    const processingNull = await seedPost({ labels: null, runStatus: "processing" });
    const failedNull = await seedPost({ labels: null, runStatus: "failed" });
    const failedRerunIrr = await seedPost({ labels: { relevance: "irrelevant" }, runStatus: "failed" });
    const failedRerunRel = await seedPost({ runStatus: "failed" });
    const relevantDone = await seedPost({});
    const ids = async (f: Record<string, string>) =>
      ((await get(f).expect(200)).body as { items: { id: string }[] }).items.map((x) => x.id).sort();

    expect(await ids({ analysisStatus: "failed" })).toEqual([failedNull, failedRerunRel].sort());
    expect(await ids({ analysisStatus: "failed", relevance: "irrelevant" })).toEqual(
      [failedNull, failedRerunIrr].sort(),
    );
    expect(await ids({ analysisStatus: "pending,processing" })).toEqual([pendingNull, processingNull].sort());
    expect(await ids({ analysisStatus: "pending,completed" })).toEqual([relevantDone]);
    // Default list: no NULL-relevance post, no irrelevant one (BR-016 unchanged).
    expect(await ids({})).toEqual([failedRerunRel, relevantDone].sort());
    expect(await ids({ analysisStatus: "failed", sentiment: "neutral" })).toEqual([failedRerunRel]);

    const listCount = (await get({ analysisStatus: "pending,processing", count: "true" }).expect(200)).body
      .totalCount as number;
    expect(listCount).toBe(2);
    // Coverage equivalence (metric-definitions §2): no labelled pending re-run in this seed.
    const overview = await api(app, token)
      .get(`/projects/${projectId}/analytics/overview?${qs({})}`)
      .expect(200);
    expect(overview.body.coverage.pendingMentions).toBe(listCount);
    expect(overview.body.coverage.failedMentions).toBe(1);

    // Analytics base set never applies the exception.
    const { scope } = resolveMentionsScope(
      MentionsListQuerySchema.parse({ ...WEEK, analysisStatus: "failed" }),
      projectId,
    );
    const rows = await prisma.$queryRaw<{ n: number }[]>(
      withBase(scope, Prisma.sql`SELECT count(*)::int AS n FROM base`),
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("drill-down: language=other includes codes outside taxonomy (#201, FR-143)", async () => {
    const other = await seedPost({ labels: { language: "other" } });
    const fr = await seedPost({ labels: { language: "fr" } });
    const vi = await seedPost({ labels: { language: "vi" } });
    await seedPost({ labels: null }); // not analysed → language NULL, never `other`
    type Page = { items: { id: string; analysis: { language: string | null } }[] };
    const page = async (f: Record<string, string>) => (await get(f).expect(200)).body as Page;
    const res = await page({ language: "other" });
    expect(res.items.map((x) => x.id).sort()).toEqual([other, fr].sort());
    expect(res.items.map((x) => x.analysis.language)).toEqual(["other", "other"]);
    expect((await page({ language: "vi" })).items.map((x) => x.id)).toEqual([vi]);

    // Three-way equivalence: chart `other` slice == analytics base count == mentions totalCount.
    const chart = await api(app, token)
      .get(`/projects/${projectId}/analytics/languages?${qs({})}`)
      .expect(200);
    const slice = (chart.body as { distribution: { label: string; count: number }[] }).distribution.find(
      (x) => x.label === "other",
    )?.count;
    const { scope } = resolveMentionsScope(MentionsListQuerySchema.parse({ ...WEEK, language: "other" }), projectId);
    const rows = await prisma.$queryRaw<{ n: number }[]>(
      withBase(scope, Prisma.sql`SELECT count(*)::int AS n FROM base`),
    );
    const total = (await get({ language: "other", count: "true" }).expect(200)).body.totalCount;
    expect([slice, rows[0]?.n, total]).toEqual([2, 2, 2]);
  });

  it("BR-025: active override changes filtering and source", async () => {
    const id = await seedPost({});
    const reviewer = (await createUser(prisma)).id;
    await prisma.analysisOverride.create({
      data: {
        id: randomUUID(),
        postId: id,
        projectId,
        field: "sentiment",
        overrideValue: { value: "negative" },
        reviewedBy: reviewer,
      },
    });
    const res = await get({ sentiment: "negative" }).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].analysis).toMatchObject({
      hasOverride: true,
      source: "mixed",
      sentiment: { label: "negative" },
    });
  });

  it("TC-MEN-006: FTS, short-term ILIKE, NFD input, literal %, with count", async () => {
    const hit = await seedPost({ text: "Giá vé quá cao" });
    const onlyGia = await seedPost({ text: "giá thôi" });
    const pct = await seedPost({ text: "giảm 50% hôm nay" });
    await seedPost({ text: "giảm 500 hôm nay" });
    const ids = async (q: string) => {
      const res = await get({ q, count: "true" }).expect(200);
      expect(res.body.totalCount).toBe(res.body.items.length);
      return (res.body as { items: { id: string }[] }).items.map((x) => x.id).sort();
    };
    expect(await ids("giá vé")).toEqual([hit]);
    expect(await ids("giá vé")).toEqual([hit]);
    expect(await ids("vé")).toEqual([hit]);
    expect(await ids("giá")).toEqual([hit, onlyGia].sort());
    expect(await ids("0%")).toEqual([pct]);
  });

  it("projection: matchedQueries (deleted + excluded), intents order, failed errorCode, pending re-run keeps labels", async () => {
    const p = await seedPost({
      matches: { [q1]: false, [q2]: true },
      labels: {
        intents: [
          ["praise", 0.3],
          ["complaint", 0.9],
        ],
      },
    });
    await prisma.listeningQuery.update({ where: { id: q1 }, data: { deletedAt: new Date() } });
    const failed = await seedPost({ runStatus: "failed", errorCode: "OPENAI_TIMEOUT" });
    const pending = await seedPost({ runStatus: "pending" });
    const res = await get({}).expect(200);
    const byId = new Map(
      (res.body.items as { id: string; matchedQueries: unknown[]; analysis: Record<string, unknown> }[]).map((x) => [
        x.id,
        x,
      ]),
    );
    // Same first_matched_at → ordered by query_id; assert membership only.
    expect(byId.get(p)?.matchedQueries).toHaveLength(2);
    expect(byId.get(p)?.matchedQueries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: q1, excludedByTerms: false }),
        expect.objectContaining({ id: q2, excludedByTerms: true }),
      ]),
    );
    expect(byId.get(p)?.analysis.intents).toEqual([
      { label: "complaint", confidence: 0.9 },
      { label: "praise", confidence: 0.3 },
    ]);
    expect(byId.get(failed)?.analysis).toMatchObject({ status: "failed", errorCode: "OPENAI_TIMEOUT" });
    expect(byId.get(pending)?.analysis).toMatchObject({ status: "pending", relevance: { label: "relevant" } });
  });

  it("count=true times out → totalCount omitted, page still served (TC-MEN-023 bound)", async () => {
    await seedPost({});
    const repo = app.get(MentionsRepository);
    const prev = repo.countTimeoutMs;
    repo.countTimeoutMs = 100;
    let locked!: () => void;
    const isLocked = new Promise<void>((r) => (locked = r));
    let release!: () => void;
    const released = new Promise<void>((r) => (release = r));
    // #189: release the lock only once repo.count has returned (gate, not pg_sleep) — deterministic under load.
    const original = repo.count.bind(repo);
    const spy = jest.spyOn(repo, "count").mockImplementation(async (...args) => {
      try {
        return await original(...args);
      } finally {
        release();
      }
    });
    // Hold an exclusive lock so the count waits past its statement_timeout (Postgres 57014).
    const locker = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`LOCK TABLE social_posts IN ACCESS EXCLUSIVE MODE`;
        locked();
        await Promise.race([released, new Promise((r) => setTimeout(r, 20_000))]);
      },
      { timeout: 25_000 },
    );
    try {
      await isLocked;
      const res = await get({ count: "true" }).expect(200);
      expect(res.body).not.toHaveProperty("totalCount");
      expect(res.body.items).toHaveLength(1);
    } finally {
      release();
      await locker;
      spy.mockRestore();
      repo.countTimeoutMs = prev;
    }
  });

  it("access: all roles 200, outsider 403, other project's posts hidden", async () => {
    const other = (await createProject(prisma)).id;
    const oq = (await createQuery(prisma, { projectId: other })).id;
    await seedPost({ project: other, matches: { [oq]: false } });
    const mine = await seedPost({});
    for (const role of ["admin", "analyst", "viewer"] as const) {
      const t = (await createActor(prisma, { projectId, role })).token;
      const res = await get({}, t).expect(200);
      expect(res.body.items.map((x: { id: string }) => x.id)).toEqual([mine]);
    }
    const outsider = (await createActor(prisma)).token;
    expect((await get({}, outsider).expect(403)).body.error.code).toBe("FORBIDDEN_PROJECT");
  });
});
