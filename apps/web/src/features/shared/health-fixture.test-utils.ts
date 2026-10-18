import type { SystemStatusResponse } from "@how-about-me/contracts";

type Threads = SystemStatusResponse["threads"];
type Collector = SystemStatusResponse["collector"];
type Analysis = SystemStatusResponse["analysis"];

/** #345: minimal system-status payload for shell health tests (features may not import system-status fixtures). */
export function healthFixture(
  over: { threads?: Partial<Threads>; collector?: Partial<Collector>; analysis?: Partial<Analysis> } = {},
): SystemStatusResponse {
  return {
    generatedAt: "2026-10-19T03:00:00.000Z",
    threads: {
      status: "connected",
      accountIdentifier: "@ham",
      tokenExpiresAt: "2026-12-01T00:00:00.000Z",
      lastSuccessAt: "2026-10-19T02:55:00.000Z",
      lastError: null,
      ...over.threads,
    },
    collector: {
      status: "healthy",
      activeQueries: 4,
      lastGlobalSyncAt: "2026-10-19T02:50:00.000Z",
      jobsInProgress: 0,
      failedJobs24h: 0,
      partialJobs24h: 0,
      successRate24h: 1,
      collectionLagSeconds: 60,
      circuit: { open: false, until: null, reason: null },
      ...over.collector,
    },
    analysis: {
      status: "healthy",
      pending: 0,
      processing: 0,
      failed24h: 0,
      completed24h: 10,
      analysisLagSeconds: 5,
      versions: {
        classifierProvider: "openai",
        classifierModel: "gpt-x",
        promptVersion: "p1",
        taxonomyVersion: "t1",
        safetyProvider: null,
        safetyModel: null,
        safetyPolicyVersion: null,
      },
      tokens24h: { input: 0, output: 0 },
      estimatedCost24hUsd: 0,
      ...over.analysis,
    },
    database: { approxPosts: 1, approxAnalyses: 1, lastMigration: null },
  };
}
