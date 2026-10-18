import { Inject, Injectable } from "@nestjs/common";
import type { SystemStatusResponse } from "@how-about-me/contracts";
import { TAXONOMY_VERSION } from "@how-about-me/taxonomy";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { AnalysisPauseService } from "../analysis/analysis-pause.service";
import { AnalysisPolicyService } from "../analysis/settings/analysis-policy.service";
import { CircuitBreakerService } from "../collector/circuit-breaker.service";
import { SystemStatusRepository } from "./system-status.repository";
import {
  computeAnalysisFailureRate,
  computeAnalysisLagSeconds,
  computeCollectionLagSeconds,
  computeSuccessRate,
  deriveAnalysisStatus,
  deriveCollectorStatus,
} from "./system-status.rules";

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** T-057 — docs/02-architecture/05-api-contract.md §10, 09-observability.md §4 (FR-171, FR-176). */
@Injectable()
export class SystemStatusService {
  constructor(
    private readonly repo: SystemStatusRepository,
    private readonly circuit: CircuitBreakerService,
    private readonly pause: AnalysisPauseService,
    private readonly policy: AnalysisPolicyService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  async get(projectId: string, now: Date = new Date()): Promise<SystemStatusResponse> {
    const since = new Date(now.getTime() - DAY_MS);
    const [conn, queries, counts, inProgress, circuit, db, an, pause, policy] = await Promise.all([
      this.repo.findThreadsConnection(projectId),
      this.repo.enabledQueriesStats(projectId),
      this.repo.jobCountsSince(projectId, since),
      this.repo.jobsInProgress(projectId),
      this.circuit.getState(projectId, now),
      this.repo.databaseStats(),
      this.repo.analysisStats(projectId, since),
      this.pause.getState(),
      this.policy.active(projectId),
    ]);

    const integrationStatus = conn?.status ?? "disconnected";
    const successRate24h = computeSuccessRate(counts);
    const collectionLagSeconds = computeCollectionLagSeconds([queries.lastSyncAt], now);
    const analysisLagSeconds = computeAnalysisLagSeconds(an.oldestOpenCreatedAt, now);
    // Budget is system-wide per UTC day (doc 07 §9); counts/tokens/cost are per project, rolling 24h.
    const analysisStatus = deriveAnalysisStatus({
      budgetExceeded: pause.budget.exceeded,
      authPaused: pause.auth.pausedUntil !== null && pause.auth.pausedUntil.getTime() > now.getTime(),
      failureRate24h: computeAnalysisFailureRate({ failed: an.failed24h, completed: an.completed24h }),
      lagSeconds: analysisLagSeconds,
    });

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
      analysis: {
        status: analysisStatus,
        pending: an.pending,
        processing: an.processing,
        failed24h: an.failed24h,
        completed24h: an.completed24h,
        analysisLagSeconds,
        versions: {
          classifierProvider: this.cfg.ANALYSIS_CLASSIFIER_PROVIDER || null,
          classifierModel: this.cfg.ANALYSIS_CLASSIFIER_MODEL || null,
          promptVersion: this.cfg.ANALYSIS_PROMPT_VERSION,
          taxonomyVersion: TAXONOMY_VERSION,
          safetyProvider: this.cfg.SAFETY_PROVIDER || null,
          safetyModel: this.cfg.SAFETY_MODEL || null,
          safetyPolicyVersion: policy.policyVersion,
        },
        tokens24h: { input: an.inputTokens24h, output: an.outputTokens24h },
        estimatedCost24hUsd: an.estimatedCost24hUsd,
      },
      database: db,
    };
  }
}
