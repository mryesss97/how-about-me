import { SystemStatusResponseSchema } from "@how-about-me/contracts";
import type { CircuitBreakerService } from "../collector/circuit-breaker.service";
import type { SystemStatusRepository } from "./system-status.repository";
import { SystemStatusService } from "./system-status.service";

const now = new Date("2026-10-18T00:00:00Z");

function build(conn: Awaited<ReturnType<SystemStatusRepository["findThreadsConnection"]>>) {
  const repo = {
    findThreadsConnection: jest.fn().mockResolvedValue(conn),
    enabledQueriesStats: jest
      .fn()
      .mockResolvedValue({ count: 2, lastSyncAt: new Date(now.getTime() - 120_000), maxPollIntervalSeconds: 600 }),
    jobCountsSince: jest.fn().mockResolvedValue({ success: 3, partial: 1, failed: 1 }),
    jobsInProgress: jest.fn().mockResolvedValue(1),
    databaseStats: jest.fn().mockResolvedValue({ approxPosts: 10, approxAnalyses: 5, lastMigration: "m1" }),
  } as unknown as SystemStatusRepository;
  const circuit = {
    getState: jest.fn().mockResolvedValue({ open: false, until: null, reason: null }),
  } as unknown as CircuitBreakerService;
  return new SystemStatusService(repo, circuit);
}

describe("SystemStatusService (T-057, FR-171)", () => {
  it("maps DTO, parses with contract, analysis stub zeros", async () => {
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
    expect(res.analysis).toMatchObject({ pending: 0, processing: 0, estimatedCost24hUsd: 0, analysisLagSeconds: 0 });
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
