import { Inject, Injectable, Optional, type BeforeApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { PinoLogger } from "nestjs-pino";
import { AppError } from "../common/errors/app.error";
import { APP_CONFIG, type AppConfig } from "../config/config.module";
import { CircuitBreakerService } from "../modules/collector/circuit-breaker.service";
import { COLLECTOR_RUNNER, type ClaimedQuery, type CollectorRunner, type RunOutcome } from "./collector-runner";
import { computeNextRunAt } from "./next-run";
import { QueryClaimRepository } from "./query-claim.repository";
import { runWithConcurrency } from "./run-with-concurrency";

export const COLLECTOR_TICK_INTERVAL = "collector-tick";
const SHUTDOWN_WAIT_MS = 30_000;
const MAX_ERROR_MESSAGE_LENGTH = 1_000;

/** Collector tick — FR-070/071/086, docs/02-architecture/02-backend-design.md §6. */
@Injectable()
export class SchedulerService implements OnModuleInit, BeforeApplicationShutdown {
  readonly workerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  private current: Promise<void> | null = null;
  private readonly abort = new AbortController();

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Optional() @Inject(COLLECTOR_RUNNER) private readonly runner: CollectorRunner | null,
    private readonly repo: QueryClaimRepository,
    private readonly registry: SchedulerRegistry,
    private readonly logger: PinoLogger,
    @Optional() @Inject(CircuitBreakerService) private readonly breaker: CircuitBreakerService | null = null,
  ) {
    this.logger.setContext(SchedulerService.name);
  }

  onModuleInit() {
    // Only worker/all roles schedule; api role never claims (backend-design §6).
    if (this.cfg.APP_ROLE !== "worker" && this.cfg.APP_ROLE !== "all") return;
    if (!this.runner) {
      this.logger.warn(
        { workerId: this.workerId },
        "no collector runner bound (T-052); collector scheduler not started",
      );
      return;
    }
    const handle = setInterval(() => void this.tick(), this.cfg.COLLECTOR_TICK_MS);
    this.registry.addInterval(COLLECTOR_TICK_INTERVAL, handle);
    this.logger.info({ workerId: this.workerId, tickMs: this.cfg.COLLECTOR_TICK_MS }, "collector scheduler started");
  }

  /** One tick; overlapping calls in the same instance are skipped (returns the in-flight tick). */
  tick(): Promise<void> {
    if (this.current) return this.current;
    this.current = this.doTick().finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async doTick(): Promise<void> {
    const runner = this.runner;
    if (!runner) return; // nothing to hand claimed queries to: claiming would only hold locks
    const started = Date.now();
    let claimed: ClaimedQuery[];
    try {
      claimed = await this.repo.claimDueQueries(
        this.workerId,
        this.cfg.COLLECTOR_MAX_CONCURRENT_QUERIES,
        this.cfg.COLLECTOR_LOCK_STALE_MINUTES,
      );
    } catch (err: unknown) {
      this.logger.error({ err, workerId: this.workerId }, "collector claim failed");
      return;
    }
    if (claimed.length === 0) return;
    await runWithConcurrency(claimed, this.cfg.COLLECTOR_MAX_CONCURRENT_QUERIES, (q) => this.runOne(runner, q));
    this.logger.info(
      { workerId: this.workerId, claimed: claimed.length, durationMs: Date.now() - started },
      "collector tick done",
    );
  }

  /** Never throws: one query's failure must not abort the tick. */
  private async runOne(runner: CollectorRunner, q: ClaimedQuery): Promise<void> {
    try {
      // FR-084: in half-open only one query of the project runs as the probe; the rest keep their schedule.
      if (this.breaker && !(await this.breaker.tryAcquireProbe(q.projectId))) {
        await this.repo.releaseLock(q.id, this.workerId);
        return;
      }
      let outcome: RunOutcome;
      try {
        outcome = await runner.run(q, this.abort.signal);
      } catch (err: unknown) {
        outcome = {
          status: "failed",
          completedAt: new Date(),
          errorCode: err instanceof AppError ? err.code : "INTERNAL",
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        };
      }
      const now = new Date();
      const next = computeNextRunAt({
        status: outcome.status,
        completedAt: outcome.completedAt,
        now,
        pollIntervalSeconds: q.pollIntervalSeconds,
        consecutiveFailures: q.consecutiveFailures,
      });
      const affected = await this.repo.completeRun(q.id, this.workerId, {
        ...next,
        lastRunAt: outcome.completedAt,
        error:
          outcome.status === "failed"
            ? {
                code: outcome.errorCode ?? "INTERNAL",
                message: (outcome.errorMessage ?? "Run failed").slice(0, MAX_ERROR_MESSAGE_LENGTH),
                at: now,
              }
            : undefined,
      });
      await this.recordCircuit(q.projectId, outcome);
      if (affected === 0) this.logger.warn({ queryId: q.id, workerId: this.workerId }, "lock lost before completeRun");
    } catch (err: unknown) {
      this.logger.error({ err, queryId: q.id }, "collector run bookkeeping failed");
    }
  }

  /** Breaker bookkeeping failures are logged and never break the tick (FR-084). */
  private async recordCircuit(projectId: string, outcome: RunOutcome): Promise<void> {
    if (!this.breaker) return;
    try {
      await this.breaker.recordOutcome(projectId, outcome);
    } catch (err: unknown) {
      this.logger.error({ err, projectId }, "collector circuit bookkeeping failed");
    }
  }

  async beforeApplicationShutdown() {
    if (this.registry.doesExist("interval", COLLECTOR_TICK_INTERVAL))
      this.registry.deleteInterval(COLLECTOR_TICK_INTERVAL);
    this.abort.abort();
    if (this.current) {
      await Promise.race([this.current, new Promise<void>((r) => setTimeout(r, SHUTDOWN_WAIT_MS).unref())]);
    }
    try {
      await this.repo.releaseLocks(this.workerId);
    } catch (err: unknown) {
      this.logger.error({ err }, "release locks on shutdown failed");
    }
  }
}
