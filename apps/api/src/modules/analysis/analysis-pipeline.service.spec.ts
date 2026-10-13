import {
  DEFAULT_ANALYSIS_POLICY,
  SAFETY_POLICY_V1,
  TAXONOMY_VERSION,
  type AnalysisPolicy,
} from "@how-about-me/taxonomy";
import type { PinoLogger } from "nestjs-pino";
import { ProviderError } from "../../common/errors/provider.error";
import type { AppConfig } from "../../config/config.module";
import type { PrismaService } from "../../database/prisma.service";
import { AnalysisLockLostError } from "./analysis-failure-policy";
import { AnalysisPipelineService } from "./analysis-pipeline.service";
import type { AnalysisService, ClaimedRun } from "./analysis.service";
import type { AnalysisPolicyService } from "./settings/analysis-policy.service";
import { FakeContentClassifier } from "./providers/fake-classifier.provider";
import { FakeSafetyProvider } from "./providers/fake-safety.provider";

const run: ClaimedRun = {
  id: "00000000-0000-7000-8000-000000000001",
  postId: "00000000-0000-7000-8000-000000000002",
  projectId: "00000000-0000-7000-8000-000000000003",
  trigger: "ingest",
  sourceContentHash: "h",
  sourceRevision: 1,
  effectiveVersion: "fake|fake-classifier|classifier-v1|taxonomy-v1|fake|fake-moderation|safety-policy-v1",
  attemptCount: 1,
  lockedBy: "w1",
};

const V2_POLICY: AnalysisPolicy = {
  version: 2,
  policyVersion: "safety-policy-v2",
  confidenceBands: { high: 0.9, medium: 0.7 },
  safetyThresholds: { ...SAFETY_POLICY_V1, hate: { sensitive: 0.4, severe: 0.7 } },
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
    runVersions: jest.fn((safetyPolicyVersion: string) => ({
      classifierProvider: "fake",
      classifierModel: "fake-classifier",
      promptVersion: "classifier-v1",
      taxonomyVersion: TAXONOMY_VERSION,
      safetyProvider: "fake",
      safetyModel: "fake-moderation",
      safetyPolicyVersion,
    })),
  };
  const policies = {
    byPolicyVersion: jest.fn(async (_pid: string, v: string) =>
      v === V2_POLICY.policyVersion ? V2_POLICY : DEFAULT_ANALYSIS_POLICY,
    ),
  };
  const classifier = new FakeContentClassifier();
  const safety = new FakeSafetyProvider();
  const spies = {
    relevance: jest.spyOn(classifier, "relevance"),
    classify: jest.spyOn(classifier, "classify"),
    moderate: jest.spyOn(safety, "moderate"),
  };
  const cfg = { ANALYSIS_TWO_STEP: opts.twoStep ?? false, ANALYSIS_BRAND_CONTEXT: "brand" } as AppConfig;
  const logger = { info: jest.fn(), warn: jest.fn() } as unknown as PinoLogger;
  const svc = new AnalysisPipelineService(
    prisma as unknown as PrismaService,
    analysis as unknown as AnalysisService,
    classifier,
    safety,
    cfg,
    logger,
    policies as unknown as AnalysisPolicyService,
  );
  return { svc, tx, analysis, spies, policies };
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
    await expect(m.svc.process(run)).rejects.toBeInstanceOf(AnalysisLockLostError);
    expect(m.analysis.setCurrentAnalysis).not.toHaveBeenCalled();
  });

  it("ANALYSIS_PROVIDER_AUTH from classify is rethrown without a corrective retry", async () => {
    const m = make();
    m.spies.classify.mockRejectedValueOnce(new ProviderError("ANALYSIS_PROVIDER_AUTH", "401"));
    await expect(m.svc.process(run)).rejects.toMatchObject({ code: "ANALYSIS_PROVIDER_AUTH" });
    expect(m.spies.classify).toHaveBeenCalledTimes(1);
    expect(m.tx.postAnalysis.create).not.toHaveBeenCalled();
  });
});

describe("AnalysisPipelineService corrective retry (FR-113, FR-119, T-075)", () => {
  const usage = { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 };
  const valid = {
    relevance: { label: "relevant" as const, confidence: 0.9, explanation: "x" },
    sentiment: { label: "positive" as const, confidence: 0.9 },
    intents: [{ label: "praise" as const, confidence: 0.9 }],
    topics: [{ label: "ticket" as const, confidence: 0.9 }],
    language: "vi" as const,
    summary: "s",
    usage,
  };
  const ticketing = { ...valid, intents: [{ label: "ticketing", confidence: 0.9 }] } as unknown as typeof valid;

  it("TC-ANA-011: unknown intent twice → 2 calls, 2nd carries correction, fails ANALYSIS_SCHEMA_INVALID", async () => {
    const m = make();
    m.spies.classify.mockResolvedValue(ticketing);
    const err: unknown = await m.svc.process(run).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err).toMatchObject({ code: "ANALYSIS_SCHEMA_INVALID" });
    expect((err as Error).message).not.toContain("1zone concert");
    expect(m.spies.classify).toHaveBeenCalledTimes(2);
    const second = m.spies.classify.mock.calls[1]?.[0];
    expect(second?.correction?.issues.some((i) => i.startsWith("intents"))).toBe(true);
    expect(m.tx.postAnalysis.create).not.toHaveBeenCalled();
  });

  it("FR-113: invalid then valid → completes and usage of both calls is summed", async () => {
    const m = make();
    m.spies.classify.mockResolvedValueOnce(ticketing).mockResolvedValueOnce(valid);
    await m.svc.process(run);
    expect(m.spies.classify).toHaveBeenCalledTimes(2);
    const u = m.analysis.markCompleted.mock.calls[0] as unknown[];
    expect(u[2]).toMatchObject({ inputTokens: 20, outputTokens: 10 });
  });

  it("FR-113: adapter ANALYSIS_SCHEMA_INVALID with details.issues → 2nd call gets those issues", async () => {
    const m = make();
    m.spies.classify
      .mockRejectedValueOnce(
        new ProviderError("ANALYSIS_SCHEMA_INVALID", "m", { details: { issues: ["topics: bad"] } }),
      )
      .mockResolvedValueOnce(valid);
    await m.svc.process(run);
    expect(m.spies.classify.mock.calls[1]?.[0].correction).toEqual({ issues: ["topics: bad"] });
  });

  it("FR-113: two-step relevance() invalid → corrective retry", async () => {
    const m = make({ twoStep: true });
    m.spies.relevance
      .mockResolvedValueOnce({ relevance: { label: "maybe", confidence: 0.9, explanation: "x" }, usage } as never)
      .mockResolvedValueOnce({ relevance: valid.relevance, language: "vi", usage });
    m.spies.classify.mockResolvedValueOnce(valid);
    await m.svc.process(run);
    expect(m.spies.relevance).toHaveBeenCalledTimes(2);
    expect(m.spies.relevance.mock.calls[1]?.[0].correction?.issues[0]).toMatch(/^label/);
  });

  it("Q5: moderation ANALYSIS_SCHEMA_INVALID is rethrown without retry", async () => {
    const m = make();
    m.spies.classify.mockResolvedValueOnce(valid);
    m.spies.moderate.mockRejectedValueOnce(new ProviderError("ANALYSIS_SCHEMA_INVALID", "shape"));
    await expect(m.svc.process(run)).rejects.toMatchObject({ code: "ANALYSIS_SCHEMA_INVALID" });
    expect(m.spies.moderate).toHaveBeenCalledTimes(1);
    expect(m.spies.classify).toHaveBeenCalledTimes(1);
  });

  it("FR-190 / BR-023: uses the policy recorded in the run's effective_version and stamps it", async () => {
    const m = make();
    const v2Run = { ...run, effectiveVersion: run.effectiveVersion.replace("safety-policy-v1", "safety-policy-v2") };
    await m.svc.process(v2Run);
    expect(m.policies.byPolicyVersion).toHaveBeenCalledWith(run.projectId, "safety-policy-v2");
    expect(m.spies.classify.mock.calls[0]?.[0].confidenceBands).toEqual({ high: 0.9, medium: 0.7 });
    const opts = m.analysis.markCompleted.mock.calls[0] as unknown[];
    expect(opts[4]).toMatchObject({ versions: { safetyPolicyVersion: "safety-policy-v2" } });
  });

  it("BR-023: a v1 run stamps safety-policy-v1 with default bands", async () => {
    const m = make();
    await m.svc.process(run);
    expect(m.policies.byPolicyVersion).toHaveBeenCalledWith(run.projectId, "safety-policy-v1");
    expect(m.spies.classify.mock.calls[0]?.[0].confidenceBands).toEqual({ high: 0.8, medium: 0.6 });
    const opts = m.analysis.markCompleted.mock.calls[0] as unknown[];
    expect(opts[4]).toMatchObject({ versions: { safetyPolicyVersion: "safety-policy-v1" } });
  });
});
