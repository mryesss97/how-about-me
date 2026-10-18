import type { SyncJob, SyncJobDetail, SystemStatusResponse } from "@how-about-me/contracts";

let n = 0;
export const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

export function statusFixture(over: Partial<SystemStatusResponse> = {}): SystemStatusResponse {
  return {
    generatedAt: "2026-10-13T03:00:00.000Z",
    threads: {
      status: "connected",
      accountIdentifier: "@ham",
      tokenExpiresAt: "2026-12-01T00:00:00.000Z",
      lastSuccessAt: "2026-10-13T02:55:00.000Z",
      lastError: null,
    },
    collector: {
      status: "healthy",
      activeQueries: 4,
      lastGlobalSyncAt: "2026-10-13T02:50:00.000Z",
      jobsInProgress: 1,
      failedJobs24h: 3,
      partialJobs24h: 2,
      successRate24h: 0.9,
      collectionLagSeconds: 720,
      circuit: { open: false, until: null, reason: null },
    },
    analysis: {
      status: "healthy",
      pending: 17,
      processing: 2,
      failed24h: 1,
      completed24h: 300,
      analysisLagSeconds: 45,
      versions: {
        classifierProvider: "openai",
        classifierModel: "gpt-x",
        promptVersion: "p1",
        taxonomyVersion: "t1",
        safetyProvider: null,
        safetyModel: null,
        safetyPolicyVersion: null,
      },
      tokens24h: { input: 1000, output: 200 },
      estimatedCost24hUsd: 1.23,
    },
    database: { approxPosts: 12345, approxAnalyses: 23456, lastMigration: "20261001_init" },
    ...over,
  };
}

export function jobFixture(over: Partial<SyncJob> = {}): SyncJob {
  n += 1;
  return {
    id: uuid(n),
    queryId: uuid(500),
    status: "success",
    trigger: "scheduled",
    searchType: "RECENT",
    searchMode: "KEYWORD",
    windowSince: "2026-10-13T02:00:00.000Z",
    windowUntil: "2026-10-13T03:00:00.000Z",
    startedAt: "2026-10-13T03:00:00.000Z",
    completedAt: "2026-10-13T03:00:30.000Z",
    pagesFetched: 2,
    recordsFetched: 40,
    recordsInserted: 10,
    recordsUpdated: 5,
    recordsDuplicated: 25,
    recordsInvalid: 0,
    recordsExcluded: 0,
    providerRequests: 2,
    rateLimitEvents: 0,
    lastCursor: null,
    error: null,
    createdAt: "2026-10-13T03:00:00.000Z",
    ...over,
  };
}

export function jobDetailFixture(over: Partial<SyncJobDetail> = {}): SyncJobDetail {
  return { ...jobFixture(), providerUsage: null, ...over };
}
