import type { INestApplication } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import { ANALYSIS_ENQUEUER } from "../../src/modules/analysis/analysis-enqueuer";
import type { AnalysisService } from "../../src/modules/analysis/analysis.service";
import { IngestionService, type IngestionQuery } from "../../src/modules/collector/ingestion.service";
import { normalizeItem, type NormalizedPost } from "../../src/modules/collector/post-normalizer";
import type { PrismaService } from "../../src/database/prisma.service";
import { createTestApp, resetDb } from "../helpers/app";

function post(id: string, text: string): NormalizedPost {
  const r = normalizeItem({ id, text, timestamp: "2026-10-01T10:00:00+0000", username: "u" });
  if (!r.ok) throw new Error("fixture invalid");
  return r.post;
}

describe("IngestionService (T-051)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: IngestionService;
  let projectId: string;
  let qA: IngestionQuery;
  let qB: IngestionQuery;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    svc = app.get(IngestionService);
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  async function makeQuery(value: string, excludeTerms: string[] = []): Promise<IngestionQuery> {
    const id = uuidv7();
    await prisma.listeningQuery.create({
      data: {
        id,
        projectId,
        displayName: value,
        queryValue: value,
        queryType: "keyword",
        searchMode: "KEYWORD",
        excludeTerms,
      },
    });
    return { id, projectId, platform: "threads", includeTerms: [], excludeTerms };
  }

  beforeEach(async () => {
    await resetDb(prisma);
    projectId = uuidv7();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
    qA = await makeQuery("1zone");
    qB = await makeQuery("eventista");
  });

  it("TC-COL-011 / FR-076 / BR-002: re-ingest counts duplicated, one post, revision stays 1", async () => {
    expect(await svc.ingestPage(qA, [post("p1", "hello 1zone")])).toMatchObject({ inserted: 1, duplicated: 0 });
    const before = await prisma.socialPost.findFirstOrThrow();
    expect(await svc.ingestPage(qA, [post("p1", "hello 1zone")])).toMatchObject({ inserted: 0, duplicated: 1 });
    const after = await prisma.socialPost.findFirstOrThrow();
    expect(await prisma.socialPost.count()).toBe(1);
    expect(after.revision).toBe(1);
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(before.lastSeenAt.getTime());
  });

  it("TC-COL-012 / FR-077 / BR-002: same post from two queries → 1 post, 2 matches, 1 run", async () => {
    await svc.ingestPage(qA, [post("p1", "1zone eventista")]);
    await svc.ingestPage(qB, [post("p1", "1zone eventista")]);
    expect(await prisma.socialPost.count()).toBe(1);
    expect(await prisma.postQueryMatch.count()).toBe(2);
    expect(await prisma.analysisRun.count()).toBe(1);
  });

  it("TC-COL-013 / FR-078 / BR-003: edited text → revision 2, old run stale, new content_change run", async () => {
    await svc.ingestPage(qA, [post("p1", "v1 1zone")]);
    await prisma.analysisRun.updateMany({ data: { status: "completed" } });
    const res = await svc.ingestPage(qA, [post("p1", "v2 1zone")]);
    expect(res).toMatchObject({ updated: 1, enqueued: 1 });
    const p = await prisma.socialPost.findFirstOrThrow();
    expect(p.revision).toBe(2);
    expect(p.text).toBe("v2 1zone");
    expect(p.contentHash).toBe(post("p1", "v2 1zone").contentHash);
    const runs = await prisma.analysisRun.findMany({ orderBy: { createdAt: "asc" } });
    expect(runs.map((r) => r.status)).toEqual(["stale", "pending"]);
    expect(runs[1]).toMatchObject({ trigger: "content_change", sourceRevision: 2 });
  });

  it("TC-COL-025 / FR-088 / BR-024: exactly one pending run, also under concurrent enqueue", async () => {
    await svc.ingestPage(qA, [post("p1", "1zone")]);
    await svc.ingestPage(qA, [post("p1", "1zone")]);
    expect(await prisma.analysisRun.count()).toBe(1);
    const run = await prisma.analysisRun.findFirstOrThrow();
    expect(run).toMatchObject({ status: "pending", trigger: "ingest" });
    expect(run.effectiveVersion.startsWith("fake")).toBe(true);
    expect((await prisma.socialPost.findFirstOrThrow()).latestRunStatus).toBe("pending");

    await prisma.analysisRun.deleteMany();
    const enq = app.get<AnalysisService>(ANALYSIS_ENQUEUER);
    const input = {
      postId: run.postId,
      projectId,
      contentHash: run.sourceContentHash,
      revision: 1,
      trigger: "ingest" as const,
    };
    // #189: default maxWait (2 s) is too tight when the pool opens new connections on a loaded machine (P2028);
    // this test checks the BR-024 invariant, not latency.
    const created = await Promise.all(
      [1, 2, 3].map(() => prisma.$transaction((tx) => enq.enqueue(tx, input), { maxWait: 10_000 })),
    );
    expect(created.filter(Boolean)).toHaveLength(1);
    expect(await prisma.analysisRun.count()).toBe(1);
  });

  it("TC-LQ-016 / BR-007: excluded post is stored and flagged without a run; non-excluded match enqueues", async () => {
    const qX = await makeQuery("1zone-x", ["time zone"]);
    const res = await svc.ingestPage(qX, [post("p1", "what time zone is 1zone")]);
    expect(res).toMatchObject({ inserted: 1, excluded: 1, enqueued: 0 });
    expect((await prisma.postQueryMatch.findFirstOrThrow()).excludedByTerms).toBe(true);
    expect(await prisma.analysisRun.count()).toBe(0);

    const res2 = await svc.ingestPage(qB, [post("p1", "what time zone is 1zone")]);
    expect(res2).toMatchObject({ duplicated: 1, excluded: 0, enqueued: 1 });
    expect(await prisma.analysisRun.count()).toBe(1);
  });

  it("BR-002: duplicate platformPostId inside one page → inserted 1, duplicated 1", async () => {
    const res = await svc.ingestPage(qA, [post("p1", "a"), post("p1", "a")]);
    expect(res).toMatchObject({ inserted: 1, duplicated: 1 });
  });

  it("BR-002: two concurrent pages with the same new post → 1 inserted, 1 duplicated, 1 run", async () => {
    const results = await Promise.all([qA, qB].map((q) => svc.ingestPage(q, [post("p1", "1zone eventista")])));
    const sum = (k: "inserted" | "updated" | "duplicated") => results.reduce((n, r) => n + r[k], 0);
    expect({ inserted: sum("inserted"), updated: sum("updated"), duplicated: sum("duplicated") }).toEqual({
      inserted: 1,
      updated: 0,
      duplicated: 1,
    });
    expect(await prisma.socialPost.count()).toBe(1);
    expect((await prisma.socialPost.findFirstOrThrow()).revision).toBe(1);
    expect(await prisma.postQueryMatch.count()).toBe(2);
    expect(await prisma.analysisRun.count()).toBe(1);
  });

  it("rolls back the whole page when the enqueuer throws", async () => {
    const enq = app.get<AnalysisService>(ANALYSIS_ENQUEUER);
    const spy = jest.spyOn(enq, "enqueue").mockRejectedValueOnce(new Error("boom"));
    await expect(svc.ingestPage(qA, [post("p1", "x")])).rejects.toThrow("boom");
    spy.mockRestore();
    expect(await prisma.socialPost.count()).toBe(0);
    expect(await prisma.postQueryMatch.count()).toBe(0);
  });
});
