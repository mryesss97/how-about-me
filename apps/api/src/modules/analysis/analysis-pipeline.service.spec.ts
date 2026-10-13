import type { PinoLogger } from "nestjs-pino";
import { ProviderError } from "../../common/errors/provider.error";
import type { AppConfig } from "../../config/config.module";
import type { PrismaService } from "../../database/prisma.service";
import { AnalysisPipelineService } from "./analysis-pipeline.service";
import type { AnalysisService, ClaimedRun } from "./analysis.service";
import { FakeContentClassifier } from "./providers/fake-classifier.provider";
import { FakeSafetyProvider } from "./providers/fake-safety.provider";

const run: ClaimedRun = {
  id: "00000000-0000-7000-8000-000000000001",
  postId: "00000000-0000-7000-8000-000000000002",
  projectId: "00000000-0000-7000-8000-000000000003",
  trigger: "ingest",
  sourceContentHash: "h",
  sourceRevision: 1,
  effectiveVersion: "v",
  attemptCount: 1,
  lockedBy: "w1",
};

function make(opts: { text?: string | null; revision?: number; twoStep?: boolean; missing?: boolean } = {}) {
  const tx = {
    postAnalysis: { create: jest.fn(async () => ({})) },
    analysisIntent: { createMany: jest.fn(async () => ({ count: 1 })) },
    analysisTopic: { createMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma = {
    socialPost: {
      findUnique: jest.fn(async () =>
        opts.missing
          ? null
          : {
              text: opts.text === undefined ? "1zone concert xịn quá" : opts.text,
              username: "u",
              revision: opts.revision ?? 1,
              project: { name: "P", description: null },
            },
      ),
    },
    postQueryMatch: { findMany: jest.fn(async () => [{ query: { queryValue: "1zone" } }]) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  };
  const analysis = {
    markSkipped: jest.fn(async () => true),
    markCompleted: jest.fn(async () => true),
    setCurrentAnalysis: jest.fn(async () => true),
  };
  const classifier = new FakeContentClassifier();
  const safety = new FakeSafetyProvider();
  const spies = {
    relevance: jest.spyOn(classifier, "relevance"),
    classify: jest.spyOn(classifier, "classify"),
    moderate: jest.spyOn(safety, "moderate"),
  };
  const cfg = { ANALYSIS_TWO_STEP: opts.twoStep ?? false, ANALYSIS_BRAND_CONTEXT: "brand" } as AppConfig;
  const logger = { info: jest.fn() } as unknown as PinoLogger;
  const svc = new AnalysisPipelineService(
    prisma as unknown as PrismaService,
    analysis as unknown as AnalysisService,
    classifier,
    safety,
    cfg,
    logger,
  );
  return { svc, tx, analysis, spies };
}

describe("AnalysisPipelineService (T-074)", () => {
  it("TC-ANA-023: empty text → skipped empty_text, no provider call", async () => {
    const m = make({ text: "   " });
    await m.svc.process(run);
    expect(m.analysis.markSkipped).toHaveBeenCalledWith(run.id, "w1", "empty_text");
    expect(m.spies.classify).not.toHaveBeenCalled();
    expect(m.spies.moderate).not.toHaveBeenCalled();
  });

  it("FR-078: revision mismatch or missing post → skipped superseded", async () => {
    for (const m of [make({ revision: 2 }), make({ missing: true })]) {
      await m.svc.process(run);
      expect(m.analysis.markSkipped).toHaveBeenCalledWith(run.id, "w1", "superseded");
      expect(m.spies.classify).not.toHaveBeenCalled();
    }
  });

  it("TC-ANA-005 / FR-102: two-step irrelevant → classify and moderate not called", async () => {
    const m = make({ text: "đổi time zone trên máy", twoStep: true });
    await m.svc.process(run);
    expect(m.spies.relevance).toHaveBeenCalledTimes(1);
    expect(m.spies.classify).not.toHaveBeenCalled();
    expect(m.spies.moderate).not.toHaveBeenCalled();
    expect(m.tx.analysisIntent.createMany).not.toHaveBeenCalled();
    expect(m.analysis.markCompleted).toHaveBeenCalledWith(
      run.id,
      "w1",
      expect.any(Object),
      m.tx,
      expect.objectContaining({ skippedReason: "irrelevant" }),
    );
  });

  it("FR-102: single-step irrelevant → gate applied after classify, moderation skipped", async () => {
    const m = make({ text: "đổi time zone trên máy" });
    await m.svc.process(run);
    expect(m.spies.classify).toHaveBeenCalledTimes(1);
    expect(m.spies.moderate).not.toHaveBeenCalled();
    expect(m.tx.postAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ relevanceLabel: "irrelevant", summary: "" }),
    });
    expect(m.tx.analysisTopic.createMany).not.toHaveBeenCalled();
  });

  it("FR-103 / BR-023: relevant post → safety + labels persisted, 7 versions stamped, pointer set", async () => {
    const m = make({ twoStep: true });
    await m.svc.process(run);
    expect(m.spies.classify).toHaveBeenCalledWith(
      expect.objectContaining({ matchedTerms: ["1zone"], brandContext: "brand" }),
      expect.objectContaining({ runId: run.id }),
    );
    expect(m.tx.postAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ safetyLevel: expect.any(String), safetyFlagged: expect.any(Boolean) }),
    });
    expect(m.tx.analysisIntent.createMany).toHaveBeenCalled();
    const opts = m.analysis.markCompleted.mock.calls[0] as unknown[];
    expect(opts[4]).toMatchObject({
      skippedReason: undefined,
      versions: { classifierProvider: "fake", safetyProvider: "fake" },
    });
    expect(m.analysis.setCurrentAnalysis).toHaveBeenCalledWith(m.tx, run.postId, run.id, expect.any(String));
  });

  it("watchdog race: markCompleted false → transaction throws, pointer untouched", async () => {
    const m = make();
    m.analysis.markCompleted.mockResolvedValueOnce(false);
    await expect(m.svc.process(run)).rejects.toThrow(/no longer held/);
    expect(m.analysis.setCurrentAnalysis).not.toHaveBeenCalled();
  });

  it("provider errors (schema invalid / auth) are rethrown to the worker (T-075 seam)", async () => {
    const m = make();
    m.spies.classify.mockRejectedValueOnce(new ProviderError("ANALYSIS_SCHEMA_INVALID", "intents: bad"));
    await expect(m.svc.process(run)).rejects.toBeInstanceOf(ProviderError);
    expect(m.tx.postAnalysis.create).not.toHaveBeenCalled();
  });
});
