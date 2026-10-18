import { SystemStatusResponseSchema } from "@how-about-me/contracts";
import type { AppConfig } from "../../config/config.module";
import type { AnalysisPauseService } from "../analysis/analysis-pause.service";
import type { AnalysisPolicyService } from "../analysis/settings/analysis-policy.service";
import type { CircuitBreakerService } from "../collector/circuit-breaker.service";
import type { SystemStatusRepository } from "./system-status.repository";
import { SystemStatusService } from "./system-status.service";

const now = new Date("2026-10-18T00:00:00Z");

type Pause = { budgetExceeded?: boolean; pausedUntil?: Date | null };

function build(conn: Awaited<ReturnType<SystemStatusRepository["findThreadsConnection"]>>, p: Pause = {}) {
  const repo = {
    findThreadsConnection: jest.fn().mockResolvedValue(conn),
    enabledQueriesStats: jest
      .fn()
      .mockResolvedValue({ count: 2, lastSyncAt: new Date(now.getTime() - 120_000), maxPollIntervalSeconds: 600 }),
    jobCountsSince: jest.fn().mockResolvedValue({ success: 3, partial: 1, failed: 1 }),
    jobsInProgress: jest.fn().mockResolvedValue(1),
    databaseStats: jest.fn().mockResolvedValue({ approxPosts: 10, approxAnalyses: 5, lastMigration: "m1" }),
    analysisStats: jest.fn().mockResolvedValue({
      pending: 3,
      processing: 1,
      failed24h: 1,
      completed24h: 19,
      oldestOpenCreatedAt: new Date(now.getTime() - 90_500),
      inputTokens24h: 1000,
      outputTokens24h: 200,
      estimatedCost24hUsd: 0.25,
    }),
  } as unknown as SystemStatusRepository;
  const circuit = {
    getState: jest.fn().mockResolvedValue({ open: false, until: null, reason: null }),
  } as unknown as CircuitBreakerService;
  const pause = {
    getState: jest.fn().mockResolvedValue({
      budget: { exceeded: p.budgetExceeded ?? false },
      auth: { lastFailureAt: null, pausedUntil: p.pausedUntil ?? null },
    }),
  } as unknown as AnalysisPauseService;
  const policy = {
    active: jest.fn().mockResolvedValue({ policyVersion: "safety-policy-v2" }),
  } as unknown as AnalysisPolicyService;
  const cfg = {
    ANALYSIS_CLASSIFIER_PROVIDER: "openai",
    ANALYSIS_CLASSIFIER_MODEL: "",
    ANALYSIS_PROMPT_VERSION: "classifier-v2",
    SAFETY_PROVIDER: "openai",
    SAFETY_MODEL: "omni-moderation-latest",
  } as unknown as AppConfig;
  return new SystemStatusService(repo, circuit, pause, policy, cfg);
}

describe("SystemStatusService (T-057, FR-171)", () => {
  it("maps DTO, parses with contract", async () => {
    const res = await build({
      status: "connected",
      accountIdentifier: "@acme",
      tokenExpiresAt: null,
      lastSuccessAt: now,
      lastErrorCode: "THREADS_5XX",
      lastErrorMessage: null,
      lastErrorAt: now,
    }).get("p", now);
    expect(SystemStatusResponseSchema.parse(res)).toEqual(res);
    expect(res.collector).toMatchObject({
      status: "healthy",
      activeQueries: 2,
      jobsInProgress: 1,
      failedJobs24h: 1,
      partialJobs24h: 1,
      successRate24h: 0.8,
      collectionLagSeconds: 120,
    });
    expect(res.threads.lastError).toEqual({ code: "THREADS_5XX", message: "", at: now.toISOString() });
  });

  it("T-077 / FR-171: analysis block maps stats, versions and status (TC-SYS-004)", async () => {
    const res = await build(null).get("p", now);
    expect(SystemStatusResponseSchema.parse(res)).toEqual(res);
    expect(res.analysis).toMatchObject({
      status: "healthy",
      pending: 3,
      processing: 1,
      failed24h: 1,
      completed24h: 19,
      analysisLagSeconds: 90,
      tokens24h: { input: 1000, output: 200 },
      estimatedCost24hUsd: 0.25,
      versions: {
        classifierProvider: "openai",
        classifierModel: null,
        promptVersion: "classifier-v2",
        safetyModel: "omni-moderation-latest",
        safetyPolicyVersion: "safety-policy-v2",
      },
    });
  });

  it("T-077: budget exceeded → budget_paused; active auth pause → degraded; expired auth pause ignored", async () => {
    expect((await build(null, { budgetExceeded: true }).get("p", now)).analysis.status).toBe("budget_paused");
    const future = new Date(now.getTime() + 60_000);
    expect((await build(null, { pausedUntil: future }).get("p", now)).analysis.status).toBe("degraded");
    const past = new Date(now.getTime() - 1);
    expect((await build(null, { pausedUntil: past }).get("p", now)).analysis.status).toBe("healthy");
  });

  it("no connection → disconnected + collector paused", async () => {
    const res = await build(null).get("p", now);
    expect(res.threads).toEqual({
      status: "disconnected",
      accountIdentifier: null,
      tokenExpiresAt: null,
      lastSuccessAt: null,
      lastError: null,
    });
    expect(res.collector.status).toBe("paused");
  });
});
