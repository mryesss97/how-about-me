import { Injectable } from "@nestjs/common";
import type { SystemStatusResponse } from "@how-about-me/contracts";
import { CircuitBreakerService } from "../collector/circuit-breaker.service";
import { SystemStatusRepository } from "./system-status.repository";
import { computeCollectionLagSeconds, computeSuccessRate, deriveCollectorStatus } from "./system-status.rules";

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** T-057 — docs/02-architecture/05-api-contract.md §10, 09-observability.md §4 (FR-171, FR-176). */
@Injectable()
export class SystemStatusService {
  constructor(
    private readonly repo: SystemStatusRepository,
    private readonly circuit: CircuitBreakerService,
  ) {}

  async get(projectId: string, now: Date = new Date()): Promise<SystemStatusResponse> {
    const since = new Date(now.getTime() - DAY_MS);
    const [conn, queries, counts, inProgress, circuit, db] = await Promise.all([
      this.repo.findThreadsConnection(projectId),
      this.repo.enabledQueriesStats(projectId),
      this.repo.jobCountsSince(projectId, since),
      this.repo.jobsInProgress(projectId),
      this.circuit.getState(projectId, now),
      this.repo.databaseStats(),
    ]);

    const integrationStatus = conn?.status ?? "disconnected";
    const successRate24h = computeSuccessRate(counts);
    const collectionLagSeconds = computeCollectionLagSeconds([queries.lastSyncAt], now);

    return {
      generatedAt: now.toISOString(),
      threads: {
        status: integrationStatus as SystemStatusResponse["threads"]["status"],
        accountIdentifier: conn?.accountIdentifier ?? null,
        tokenExpiresAt: iso(conn?.tokenExpiresAt ?? null),
        lastSuccessAt: iso(conn?.lastSuccessAt ?? null),
        lastError:
          conn?.lastErrorCode != null
            ? {
                code: conn.lastErrorCode,
                message: conn.lastErrorMessage ?? "",
                at: (conn.lastErrorAt ?? now).toISOString(),
              }
            : null,
      },
      collector: {
        status: deriveCollectorStatus({
          circuitOpen: circuit.open,
          integrationStatus,
          successRate24h,
          collectionLagSeconds,
          maxPollIntervalSeconds: queries.maxPollIntervalSeconds,
        }),
        activeQueries: queries.count,
        lastGlobalSyncAt: iso(queries.lastSyncAt),
        jobsInProgress: inProgress,
        failedJobs24h: counts.failed,
        partialJobs24h: counts.partial,
        successRate24h,
        collectionLagSeconds,
        circuit: { open: circuit.open, until: iso(circuit.until), reason: circuit.reason },
      },
      // T-077: real analysis metrics; stub until then.
      analysis: {
        status: "healthy",
        pending: 0,
        processing: 0,
        failed24h: 0,
        completed24h: 0,
        analysisLagSeconds: 0,
        versions: {
          classifierProvider: null,
          classifierModel: null,
          promptVersion: null,
          taxonomyVersion: null,
          safetyProvider: null,
          safetyModel: null,
          safetyPolicyVersion: null,
        },
        tokens24h: { input: 0, output: 0 },
        estimatedCost24hUsd: 0,
      },
      database: db,
    };
  }
}
