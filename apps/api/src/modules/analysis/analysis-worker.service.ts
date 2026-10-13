import { hostname } from "node:os";
import { Inject, Injectable, type OnApplicationBootstrap, type OnApplicationShutdown, Optional } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { runWithConcurrency } from "../../jobs/run-with-concurrency";
import { AnalysisService, type ClaimedRun } from "./analysis.service";
import { ANALYSIS_RUN_PROCESSOR, type RunProcessor } from "./run-processor";

export const ANALYSIS_WORKER_INTERVAL = "analysis-worker";
const SHUTDOWN_WAIT_MS = 10_000;

/**
 * Analysis worker (T-070) — docs/02-architecture/02-backend-design.md §6, doc 07 §2/§8 (FR-101).
 * Polls every `ANALYSIS_POLL_MS` only when `APP_ROLE ∈ {worker, all}`, a `RunProcessor` is bound and
 * `NODE_ENV ≠ test`. Each tick: watchdog → claim batch → process with bounded concurrency.
 */
@Injectable()
export class AnalysisWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  readonly workerId = `${hostname()}:${process.pid}:${uuidv7().slice(-8)}`;
  private running: Promise<number> | null = null;

  constructor(
    private readonly analysis: AnalysisService,
    private readonly scheduler: SchedulerRegistry,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectPinoLogger(AnalysisWorkerService.name) private readonly logger: PinoLogger,
    @Optional() @Inject(ANALYSIS_RUN_PROCESSOR) private readonly processor?: RunProcessor,
  ) {}

  shouldPoll(): boolean {
    return (this.cfg.APP_ROLE === "worker" || this.cfg.APP_ROLE === "all") && this.cfg.NODE_ENV !== "test";
  }

  onApplicationBootstrap(): void {
    if (!this.shouldPoll()) return;
    if (!this.processor) {
      // Until T-074 binds a processor, do not claim runs (keeps dev data untouched).
      this.logger.info("analysis worker idle: no RunProcessor bound");
      return;
    }
    const handle = setInterval(() => void this.tick(), this.cfg.ANALYSIS_POLL_MS);
    this.scheduler.addInterval(ANALYSIS_WORKER_INTERVAL, handle);
    this.logger.info({ workerId: this.workerId, pollMs: this.cfg.ANALYSIS_POLL_MS }, "analysis worker started");
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.scheduler.doesExist("interval", ANALYSIS_WORKER_INTERVAL)) {
      this.scheduler.deleteInterval(ANALYSIS_WORKER_INTERVAL);
    }
    // Let the current batch finish; anything left in `processing` is recovered by the watchdog.
    if (this.running) {
      await Promise.race([this.running.catch(() => 0), new Promise((r) => setTimeout(r, SHUTDOWN_WAIT_MS).unref())]);
    }
  }

  /** One poll cycle. Re-entrant calls while a tick is running are skipped. Returns runs processed. */
  async tick(): Promise<number> {
    if (this.running || !this.processor) return 0;
    const processor = this.processor;
    this.running = this.runTick(processor);
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  private async runTick(processor: RunProcessor): Promise<number> {
    try {
      const stuck = await this.analysis.requeueStuck();
      if (stuck.requeued + stuck.failed > 0) this.logger.warn(stuck, "watchdog recovered stuck analysis runs");
      const runs = await this.analysis.claimBatch(this.workerId, this.cfg.ANALYSIS_BATCH_SIZE);
      await runWithConcurrency(runs, this.cfg.ANALYSIS_CONCURRENCY, (run) => this.processOne(processor, run));
      return runs.length;
    } catch (error: unknown) {
      this.logger.error({ err: error }, "analysis worker tick failed");
      return 0;
    }
  }

  private async processOne(processor: RunProcessor, run: ClaimedRun): Promise<void> {
    try {
      await processor.process(run);
    } catch (error: unknown) {
      // Unexpected processor error: re-queue (→ failed once attempts are exhausted).
      this.logger.error({ err: error, runId: run.id }, "analysis run processing threw");
      await this.analysis.requeue(run.id, this.workerId, "ANALYSIS_PROVIDER_ERROR").catch((e: unknown) => {
        this.logger.error({ err: e, runId: run.id }, "analysis run requeue failed");
      });
    }
  }
}
