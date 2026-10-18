import { Inject, Injectable, Optional } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { MetricsService } from "../../common/metrics/metrics.service";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import type { RunOutcome } from "../../jobs/collector-runner";
import { CollectorStateRepository, type CollectorStateRow } from "./collector-state.repository";

const MAX_REASON_LENGTH = 200;

export type CircuitStateName = "closed" | "open" | "half_open";
export type CircuitState = {
  state: CircuitStateName;
  open: boolean;
  until: Date | null;
  reason: string | null;
  consecutiveFailures: number;
};

/** Pure state derivation — FR-084, ingestion §7. */
export function deriveCircuitState(row: CollectorStateRow | null, threshold: number, now: Date): CircuitState {
  if (!row) return { state: "closed", open: false, until: null, reason: null, consecutiveFailures: 0 };
  const open = row.circuitOpenUntil !== null && row.circuitOpenUntil.getTime() > now.getTime();
  const state: CircuitStateName = open ? "open" : row.consecutiveFailures >= threshold ? "half_open" : "closed";
  return {
    state,
    open,
    until: row.circuitOpenUntil,
    reason: state === "closed" ? null : row.circuitReason,
    consecutiveFailures: row.consecutiveFailures,
  };
}

/**
 * Per-project collector circuit breaker stored in `collector_state` (FR-084, TC-COL-020).
 * Opens after COLLECTOR_CIRCUIT_FAILURE_THRESHOLD consecutive failed jobs; half-open after
 * COLLECTOR_CIRCUIT_OPEN_SECONDS allows exactly one probe; a successful run closes it.
 */
@Injectable()
export class CircuitBreakerService {
  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly repo: CollectorStateRepository,
    private readonly logger: PinoLogger,
    @Optional() private readonly metrics: MetricsService | null = null,
  ) {
    this.logger.setContext(CircuitBreakerService.name);
  }

  async recordOutcome(
    projectId: string,
    outcome: Pick<RunOutcome, "status" | "errorCode" | "errorMessage">,
  ): Promise<void> {
    const threshold = this.cfg.COLLECTOR_CIRCUIT_FAILURE_THRESHOLD;
    if (outcome.status === "success") {
      const prev = await this.repo.reset(projectId);
      this.metrics?.setCircuitOpen(projectId, false);
      if (prev !== null && prev >= threshold) this.logger.info({ projectId }, "collector circuit closed");
      return;
    }
    // `partial` neither counts as a failure nor resets the counter (ingestion §7).
    if (outcome.status !== "failed") return;
    const code = outcome.errorCode ?? "INTERNAL";
    const reason = `${code}: ${outcome.errorMessage ?? "Run failed"}`.slice(0, MAX_REASON_LENGTH);
    const row = await this.repo.recordFailure(projectId, threshold, this.cfg.COLLECTOR_CIRCUIT_OPEN_SECONDS, reason);
    const open = row.circuitOpenUntil !== null && row.circuitOpenUntil.getTime() > Date.now();
    this.metrics?.setCircuitOpen(projectId, open);
    if (row.consecutiveFailures >= threshold)
      this.logger.warn(
        { projectId, failures: row.consecutiveFailures, until: row.circuitOpenUntil, code },
        "collector circuit open",
      );
  }

  /** True when the run may proceed: circuit closed, or this caller won the single half-open probe. */
  async tryAcquireProbe(projectId: string): Promise<boolean> {
    const r = await this.repo.tryAcquireProbe(
      projectId,
      this.cfg.COLLECTOR_CIRCUIT_FAILURE_THRESHOLD,
      this.cfg.COLLECTOR_CIRCUIT_OPEN_SECONDS,
    );
    if (r === "acquired") this.logger.info({ projectId }, "collector circuit half-open probe acquired");
    return r !== "denied";
  }

  async getState(projectId: string, now: Date = new Date()): Promise<CircuitState> {
    return deriveCircuitState(await this.repo.find(projectId), this.cfg.COLLECTOR_CIRCUIT_FAILURE_THRESHOLD, now);
  }
}
