import type { INestApplication } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import { ProviderError } from "../../src/common/errors/provider.error";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import { PrismaService } from "../../src/database/prisma.service";
import { ANALYSIS_AUTH_PAUSE_MS } from "../../src/modules/analysis/analysis-failure-policy";
import { AnalysisPauseService } from "../../src/modules/analysis/analysis-pause.service";
import { AnalysisPipelineService } from "../../src/modules/analysis/analysis-pipeline.service";
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

const POST_TEXT = "1zone concert xịn quá, vé đáng tiền";

function post(id: string, text: string): NormalizedPost {
  const r = normalizeItem({ id, text, timestamp: "2026-10-01T10:00:00+0000", username: "u" });
  if (!r.ok) throw new Error("fixture invalid");
  return r.post;
}

const silent = { info: () => undefined, warn: () => undefined, error: () => undefined } as unknown as PinoLogger;

/** Failure handling end-to-end (T-075): FR-113, doc 07 §8/§9, TC-ANA-011/016/017/022. */
describe("Analysis failure handling (T-075)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let svc: AnalysisService;
  let ingest: IngestionService;
  let cfg: AppConfig;
  let classifier: ContentClassifier;
  let safety: SafetyProvider;
  let q: IngestionQuery;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    svc = app.get(AnalysisService);
    ingest = app.get(IngestionService);
    cfg = { ...app.get<AppConfig>(APP_CONFIG), ANALYSIS_CONCURRENCY: 1 };
    classifier = app.get<ContentClassifier>(CONTENT_CLASSIFIER);
    safety = app.get<SafetyProvider>(SAFETY_PROVIDER);
  });
  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });
  afterEach(() => jest.restoreAllMocks());

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

  function worker(c: AppConfig = cfg): { w: AnalysisWorkerService; pause: AnalysisPauseService } {
    const pause = new AnalysisPauseService(prisma, c);
    const pipeline = new AnalysisPipelineService(prisma, svc, classifier, safety, c, silent);
    const w = new AnalysisWorkerService(svc, app.get(SchedulerRegistry), c, silent, pause, pipeline);
    w.sleep = async () => undefined;
    return { w, pause };
  }
  const runs = () => prisma.analysisRun.findMany({ orderBy: { id: "asc" } });

  it("TC-ANA-016 / FR-113: 429 ×2 then ok → attempt_count=3, completed, pointer set", async () => {
    const real = classifier.classify.bind(classifier);
    jest
      .spyOn(classifier, "classify")
      .mockRejectedValueOnce(new ProviderError("ANALYSIS_PROVIDER_ERROR", "OpenAI 429", { providerStatus: 429 }))
      .mockRejectedValueOnce(new ProviderError("ANALYSIS_PROVIDER_ERROR", "OpenAI 429", { providerStatus: 429 }))
      .mockImplementation(real);
    await ingest.ingestPage(q, [post("a", POST_TEXT)]);
    const { w } = worker();
    for (let i = 0; i < 3; i++) await w.tick();
    const [r] = await runs();
    expect(r).toMatchObject({ status: "completed", attemptCount: 3 });
    const a = await prisma.postAnalysis.findUniqueOrThrow({ where: { analysisRunId: r?.id } });
    expect((await prisma.socialPost.findFirstOrThrow()).currentAnalysisId).toBe(a.id);
  });

  it("TC-ANA-017 / FR-113: 500 ×3 → failed ANALYSIS_PROVIDER_ERROR", async () => {
    jest
      .spyOn(classifier, "classify")
      .mockRejectedValue(new ProviderError("ANALYSIS_PROVIDER_ERROR", "OpenAI HTTP 500", { providerStatus: 500 }));
    await ingest.ingestPage(q, [post("b", POST_TEXT)]);
    const { w } = worker();
    for (let i = 0; i < 4; i++) await w.tick();
    const [r] = await runs();
    expect(r).toMatchObject({ status: "failed", errorCode: "ANALYSIS_PROVIDER_ERROR", attemptCount: 3 });
    expect(r?.errorMessage).toContain("500");
    expect((await prisma.socialPost.findFirstOrThrow()).latestRunStatus).toBe("failed");
  });

  it("TC-ANA-011 / FR-113 / FR-119: unknown label twice → failed ANALYSIS_SCHEMA_INVALID after 1 attempt", async () => {
    const real = classifier.classify.bind(classifier);
    const spy = jest.spyOn(classifier, "classify").mockImplementation(async (input, ctx) => {
      const out = await real(input, ctx);
      return { ...out, intents: [{ label: "ticketing", confidence: 0.9 }] } as unknown as typeof out;
    });
    await ingest.ingestPage(q, [post("c", POST_TEXT)]);
    const { w } = worker();
    await w.tick();
    const [r] = await runs();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ status: "failed", errorCode: "ANALYSIS_SCHEMA_INVALID", attemptCount: 1 });
    expect(r?.errorMessage?.length ?? 0).toBeLessThanOrEqual(500);
    expect(r?.errorMessage).not.toContain(POST_TEXT);
    expect(await prisma.postAnalysis.count()).toBe(0);
  });

  it("doc 07 §8: provider auth → failed, rest of batch released, no claim while paused", async () => {
    jest.spyOn(classifier, "classify").mockRejectedValue(new ProviderError("ANALYSIS_PROVIDER_AUTH", "OpenAI 401"));
    await ingest.ingestPage(q, [post("d1", `${POST_TEXT} 1`), post("d2", `${POST_TEXT} 2`)]);
    const { w, pause } = worker();
    await w.tick();
    // Claim order is not id order: find each run by status.
    const all = await runs();
    const r1 = all.find((r) => r.status === "failed");
    const r2 = all.find((r) => r.status !== "failed");
    expect(r1).toMatchObject({ status: "failed", errorCode: "ANALYSIS_PROVIDER_AUTH" });
    expect(r2).toMatchObject({ status: "pending", attemptCount: 0 });
    expect(await w.tick()).toBe(0);
    expect((await prisma.analysisRun.findUniqueOrThrow({ where: { id: r2?.id ?? "" } })).status).toBe("pending");
    const st = await pause.getState({ fresh: true });
    expect(st.auth.pausedUntil?.getTime()).toBe((r1?.completedAt?.getTime() ?? 0) + ANALYSIS_AUTH_PAUSE_MS);
  });

  describe("TC-ANA-022 / doc 07 §9: daily budget soft cap", () => {
    const budgetCfg = () => ({ ...cfg, ANALYSIS_DAILY_BUDGET_USD: 0.01 });

    async function seedSpent(completedAt: Date): Promise<void> {
      await ingest.ingestPage(q, [post("spent", "1zone spent")]);
      const [r] = await runs();
      await prisma.analysisRun.update({
        where: { id: r?.id ?? "" },
        data: { status: "completed", completedAt, estimatedCostUsd: 0.02 },
      });
    }

    it("over budget today → only manual runs are processed", async () => {
      await seedSpent(new Date());
      await ingest.ingestPage(q, [post("i", `${POST_TEXT} ingest`), post("m", `${POST_TEXT} manual`)]);
      const pending = await prisma.analysisRun.findMany({ where: { status: "pending" }, orderBy: { id: "asc" } });
      await prisma.analysisRun.update({ where: { id: pending[1]?.id ?? "" }, data: { trigger: "manual" } });
      const { w, pause } = worker(budgetCfg());
      expect(await w.tick()).toBe(1);
      const after = await prisma.analysisRun.findMany({ where: { id: { in: pending.map((p) => p.id) } } });
      expect(after.find((r) => r.id === pending[0]?.id)?.status).toBe("pending");
      expect(after.find((r) => r.id === pending[1]?.id)?.status).toBe("completed");
      const st = await pause.getState({ fresh: true });
      expect(st.budget).toMatchObject({ exceeded: true, limitUsd: 0.01 });
      expect(st.budget.spentTodayUsd).toBeCloseTo(0.02);
    });

    it("cost completed yesterday (UTC) does not count", async () => {
      const now = new Date();
      const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 60_000);
      await seedSpent(yesterday);
      const { pause } = worker(budgetCfg());
      const st = await pause.getState({ fresh: true });
      expect(st.budget).toMatchObject({ exceeded: false, spentTodayUsd: 0 });
    });
  });
});
