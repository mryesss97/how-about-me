import { MetricsService } from "../../src/common/metrics/metrics.service";
import type { INestApplication } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import { PrismaService } from "../../src/database/prisma.service";
import { AnalysisPipelineService } from "../../src/modules/analysis/analysis-pipeline.service";
import { AnalysisPolicyService } from "../../src/modules/analysis/settings/analysis-policy.service";
import { AnalysisPauseService } from "../../src/modules/analysis/analysis-pause.service";
import { AnalysisWorkerService } from "../../src/modules/analysis/analysis-worker.service";
import { AnalysisService } from "../../src/modules/analysis/analysis.service";
import {
  CONTENT_CLASSIFIER,
  SAFETY_PROVIDER,
  type ContentClassifier,
  type SafetyProvider,
} from "../../src/modules/analysis/providers/interfaces";
import { IngestionService, type IngestionQuery } from "../../src/modules/collector/ingestion.service";
import { normalizeItem, type NormalizedPost } from "../../src/modules/collector/post-normalizer";
import { createTestApp, resetDb } from "../helpers/app";

function post(id: string, text: string): NormalizedPost {
  const r = normalizeItem({ id, text, timestamp: "2026-10-01T10:00:00+0000", username: "u" });
  if (!r.ok) throw new Error("fixture invalid");
  return r.post;
}

const silent = { info: () => undefined, warn: () => undefined, error: () => undefined } as unknown as PinoLogger;

describe("Analysis pipeline (T-074)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: AnalysisService;
  let ingest: IngestionService;
  let w: AnalysisWorkerService;
  let q: IngestionQuery;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    svc = app.get(AnalysisService);
    ingest = app.get(IngestionService);
    // Worker wired with the real bound pipeline (ANALYSIS_RUN_PROCESSOR).
    w = new AnalysisWorkerService(
      svc,
      app.get(SchedulerRegistry),
      app.get<AppConfig>(APP_CONFIG),
      silent,
      new AnalysisPauseService(prisma, app.get<AppConfig>(APP_CONFIG)),
      new MetricsService(),
      app.get(AnalysisPipelineService),
    );
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    const projectId = uuidv7();
    await prisma.monitoringProject.create({ data: { id: projectId, name: "P", slug: `p-${projectId}` } });
    const id = uuidv7();
    await prisma.listeningQuery.create({
      data: { id, projectId, displayName: "1zone", queryValue: "1zone", queryType: "keyword", searchMode: "KEYWORD" },
    });
    q = { id, projectId, platform: "threads", includeTerms: [], excludeTerms: [] };
  });

  const onlyPost = () => prisma.socialPost.findFirstOrThrow();
  const runs = () => prisma.analysisRun.findMany({ orderBy: { id: "asc" } });

  it("TC-ANA-001 / TC-ANA-014 / FR-100: ingest → worker → analysis + labels + pointer + 7 versions", async () => {
    await ingest.ingestPage(q, [post("a", "1zone concert xịn quá, vé đáng tiền")]);
    await w.tick();
    const [r] = await runs();
    expect(r).toMatchObject({ status: "completed", skippedReason: null, classifierProvider: "fake" });
    for (const k of [
      "classifierProvider",
      "classifierModel",
      "promptVersion",
      "taxonomyVersion",
      "safetyProvider",
      "safetyModel",
      "safetyPolicyVersion",
    ] as const) {
      expect(r?.[k]).toBeTruthy();
    }
    const a = await prisma.postAnalysis.findUniqueOrThrow({
      where: { analysisRunId: r?.id },
      include: { intents: true, topics: true },
    });
    expect(a.createdAt).toBeInstanceOf(Date);
    expect(a.relevanceLabel).not.toBe("irrelevant");
    expect(a.intents.length).toBeGreaterThan(0);
    expect(a.topics.length).toBeGreaterThan(0);
    expect(await onlyPost()).toMatchObject({ currentAnalysisId: a.id, latestRunStatus: "completed" });
  });

  it("TC-ANA-005 / FR-102: irrelevant → completed + skipped_reason, no intents/topics, empty summary", async () => {
    await ingest.ingestPage(q, [post("b", "1zone: đổi time zone trên điện thoại sao vậy")]);
    await w.tick();
    const [r] = await runs();
    expect(r).toMatchObject({ status: "completed", skippedReason: "irrelevant" });
    const a = await prisma.postAnalysis.findUniqueOrThrow({
      where: { analysisRunId: r?.id },
      include: { intents: true, topics: true },
    });
    expect(a).toMatchObject({ relevanceLabel: "irrelevant", summary: "", safetyLevel: null, sentimentLabel: null });
    expect(a.intents).toHaveLength(0);
    expect(a.topics).toHaveLength(0);
    expect((await onlyPost()).currentAnalysisId).toBe(a.id);
  });

  it("TC-ANA-006 / FR-104 / BR-018: sensitive text → safety columns persisted", async () => {
    await ingest.ingestPage(q, [post("c", "1zone concert mà staff thằng ngu thật")]);
    await w.tick();
    const a = await prisma.postAnalysis.findFirstOrThrow();
    expect(a.safetyFlagged).toBe(true);
    expect(a.safetyLevel).not.toBe("safe");
    expect(a.safetyCategoryScores).toMatchObject({ scores: expect.any(Object), triggered: expect.any(Array) });
  });

  it("TC-ANA-023: empty text → skipped empty_text, no analysis row", async () => {
    await ingest.ingestPage(q, [post("d", "1zone")]);
    await prisma.socialPost.updateMany({ data: { text: "   " } });
    await w.tick();
    const [r] = await runs();
    expect(r).toMatchObject({ status: "skipped", skippedReason: "empty_text" });
    expect(await prisma.postAnalysis.count()).toBe(0);
  });

  it("TC-ANA-024 / FR-078 / FR-114: edit → new analysis becomes current, old one kept (append-only)", async () => {
    await ingest.ingestPage(q, [post("e", "1zone concert v1")]);
    await w.tick();
    const firstId = (await onlyPost()).currentAnalysisId;
    await ingest.ingestPage(q, [post("e", "1zone concert v2 edited, vé đắt")]);
    await w.tick();
    expect((await runs()).map((r) => r.status)).toEqual(["stale", "completed"]);
    const p = await onlyPost();
    expect(p.currentAnalysisId).not.toBe(firstId);
    expect(await prisma.postAnalysis.count()).toBe(2);
    const latest = await prisma.postAnalysis.findUniqueOrThrow({ where: { id: p.currentAnalysisId ?? "" } });
    expect(latest.analysisRunId).toBe((await runs())[1]?.id);
  });

  // FR-120, BR-041, BR-026: fake-v2 key phrases persisted with the analysis; re-analysis appends new rows.
  it("TC-ANA-030 / FR-120: key phrases stored per analysis; edit appends, old phrases kept; irrelevant none", async () => {
    await ingest.ingestPage(q, [post("p", "1zone giá vé chát quá, check-in xếp hàng mãi")]);
    await w.tick();
    const [r] = await runs();
    expect(r?.promptVersion).toBe("fake-v2");
    const first = (await onlyPost()).currentAnalysisId ?? "";
    const rows = await prisma.analysisPhrase.findMany({ where: { analysisId: first }, orderBy: { position: "asc" } });
    expect(rows.map((x) => [x.phrase, x.position])).toEqual([
      ["giá vé", 0],
      ["check-in", 1],
      ["xếp hàng", 2],
    ]);
    await ingest.ingestPage(q, [post("p", "1zone hoàn tiền chậm quá, nhân viên không trả lời")]);
    await w.tick();
    const second = (await onlyPost()).currentAnalysisId ?? "";
    expect(second).not.toBe(first);
    expect((await prisma.analysisPhrase.findMany({ where: { analysisId: second } })).map((x) => x.phrase)).toEqual([
      "hoàn tiền",
      "nhân viên",
    ]);
    expect(await prisma.analysisPhrase.count({ where: { analysisId: first } })).toBe(3);

    await ingest.ingestPage(q, [post("z", "1zone: đổi time zone check-in trên điện thoại sao vậy")]);
    await w.tick();
    const irr = await prisma.postAnalysis.findFirstOrThrow({ where: { relevanceLabel: "irrelevant" } });
    expect(await prisma.analysisPhrase.count({ where: { analysisId: irr.id } })).toBe(0);
  });

  it("TC-ANA-026 / BR-027: no raw response or reasoning stored; explanation ≤ 200", async () => {
    await ingest.ingestPage(q, [post("f", "1zone concert hay quá")]);
    await w.tick();
    const a = await prisma.postAnalysis.findFirstOrThrow();
    expect(Object.keys(a).some((k) => /raw|reason|chain|thought/i.test(k))).toBe(false);
    expect(JSON.stringify(a.safetyCategoryScores)).not.toMatch(/raw/);
    expect((a.relevanceExplanation ?? "").length).toBeLessThanOrEqual(200);
  });

  it("TC-ANA-005 two-step (ANALYSIS_TWO_STEP=true): irrelevant stops after relevance(), no classify/moderate", async () => {
    const classifier = app.get<ContentClassifier>(CONTENT_CLASSIFIER);
    const safety = app.get<SafetyProvider>(SAFETY_PROVIDER);
    const classify = jest.spyOn(classifier, "classify");
    const moderate = jest.spyOn(safety, "moderate");
    const cfg = { ...app.get<AppConfig>(APP_CONFIG), ANALYSIS_TWO_STEP: true };
    const pipeline = new AnalysisPipelineService(
      prisma,
      svc,
      classifier,
      safety,
      cfg,
      silent,
      app.get(AnalysisPolicyService),
      new MetricsService(),
    );
    const twoStep = new AnalysisWorkerService(
      svc,
      app.get(SchedulerRegistry),
      cfg,
      silent,
      new AnalysisPauseService(prisma, cfg),
      new MetricsService(),
      pipeline,
    );
    try {
      await ingest.ingestPage(q, [post("t", "1zone: đổi time zone trên điện thoại sao vậy")]);
      await twoStep.tick();
      const [r] = await runs();
      expect(r).toMatchObject({ status: "completed", skippedReason: "irrelevant" });
      const a = await prisma.postAnalysis.findUniqueOrThrow({
        where: { analysisRunId: r?.id },
        include: { intents: true, topics: true },
      });
      expect(a).toMatchObject({ relevanceLabel: "irrelevant", summary: "", safetyLevel: null });
      expect(a.intents).toHaveLength(0);
      expect(classify).not.toHaveBeenCalled();
      expect(moderate).not.toHaveBeenCalled();
      expect((await onlyPost()).currentAnalysisId).toBe(a.id);
    } finally {
      classify.mockRestore();
      moderate.mockRestore();
    }
  });

  it("FR-114: an older run finishing late does not overwrite a newer completed pointer", async () => {
    await ingest.ingestPage(q, [post("g", "1zone concert")]);
    const p = await onlyPost();
    const [old] = await runs();
    if (!old) throw new Error("seed");
    // Simulate: a newer run of the same post has already completed with its own analysis.
    const newerRunId = uuidv7();
    const newerAnalysisId = uuidv7();
    await prisma.analysisRun.create({
      data: { ...old, id: newerRunId, status: "completed", sourceContentHash: "newer" },
    });
    await prisma.postAnalysis.create({
      data: { id: newerAnalysisId, analysisRunId: newerRunId, postId: p.id, projectId: p.projectId },
    });
    await prisma.socialPost.update({ where: { id: p.id }, data: { currentAnalysisId: newerAnalysisId } });

    await w.tick();
    expect((await prisma.analysisRun.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("completed");
    expect((await onlyPost()).currentAnalysisId).toBe(newerAnalysisId);
  });
});
