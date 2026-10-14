import { hostname } from "node:os";
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  Optional,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { runWithConcurrency } from "../../jobs/run-with-concurrency";
import { ANALYSIS_AUTH_PAUSE_MS, AnalysisLockLostError, backoffMs, decideFailure } from "./analysis-failure-policy";
import { AnalysisPauseService } from "./analysis-pause.service";
import { AnalysisService, type ClaimedRun } from "./analysis.service";
import { ANALYSIS_RUN_PROCESSOR, type RunProcessor } from "./run-processor";

export const ANALYSIS_WORKER_INTERVAL = "analysis-worker";
const SHUTDOWN_WAIT_MS = 10_000;

/**
 * Analysis worker (T-070) — docs/02-architecture/02-backend-design.md §6, doc 07 §2/§8 (FR-101).
 * Polls every `ANALYSIS_POLL_MS` only when `APP_ROLE ∈ {worker, all}`, a `RunProcessor` is bound and
 * `NODE_ENV ≠ test`. Each tick: watchdog → pause check (auth / budget, T-075) → claim batch → process with
 * bounded concurrency. Failures follow `analysis-failure-policy.ts` (FR-113, doc 07 §8/§9).
 */
@Injectable()
export class AnalysisWorkerService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  readonly workerId = `${hostname()}:${process.pid}:${uuidv7().slice(-8)}`;
  private running: Promise<number> | null = null;
  /** In-memory auth pause (epoch ms) so the rest of the current batch is released immediately. */
  private authPausedUntil = 0;
  private lastPauseLog: "none" | "auth" | "budget" = "none";
  /** Aborted on shutdown so backoff sleeps end early and their runs are requeued before exit. */
  private readonly shutdown = new AbortController();
  /** Backoff sleep; resolves early on shutdown. Overridable in tests. */
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => {
      const signal = this.shutdown.signal;
      if (signal.aborted) return resolve();
      const done = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      signal.addEventListener("abort", done, { once: true });
    });

  constructor(
    private readonly analysis: AnalysisService,
    private readonly scheduler: SchedulerRegistry,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectPinoLogger(AnalysisWorkerService.name) private readonly logger: PinoLogger,
    private readonly pause: AnalysisPauseService,
    @Optional() @Inject(ANALYSIS_RUN_PROCESSOR) private readonly processor?: RunProcessor,
  ) {}

  shouldPoll(): boolean {
    return (this.cfg.APP_ROLE === "worker" || this.cfg.APP_ROLE === "all") && this.cfg.NODE_ENV !== "test";
  }

  onApplicationBootstrap(): void {
    if (!this.shouldPoll()) return;
    if (!this.processor) {
      // No processor bound (T-074 binds AnalysisPipelineService): do not claim runs.
      this.logger.info("analysis worker idle: no RunProcessor bound");
      return;
    }
    const handle = setInterval(() => void this.tick(), this.cfg.ANALYSIS_POLL_MS);
    this.scheduler.addInterval(ANALYSIS_WORKER_INTERVAL, handle);
    this.logger.info({ workerId: this.workerId, pollMs: this.cfg.ANALYSIS_POLL_MS }, "analysis worker started");
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (this.scheduler.doesExist("interval", ANALYSIS_WORKER_INTERVAL)) {
      this.scheduler.deleteInterval(ANALYSIS_WORKER_INTERVAL);
    }
    // Wake backoff sleeps (FR-113) so their runs go back to `pending` within the shutdown wait.
    this.shutdown.abort();
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

  /** In-memory auth pause end set by this worker, or null when not paused (DB signal: `AnalysisPauseService`). */
  get pausedUntil(): Date | null {
    return this.authPausedUntil > Date.now() ? new Date(this.authPausedUntil) : null;
  }

  private async runTick(processor: RunProcessor): Promise<number> {
    try {
      const stuck = await this.analysis.requeueStuck();
      if (stuck.requeued + stuck.failed > 0) this.logger.warn(stuck, "watchdog recovered stuck analysis runs");
      const state = await this.pause.getState();
      const authUntil = Math.max(this.authPausedUntil, state.auth.pausedUntil?.getTime() ?? 0);
      if (authUntil > Date.now()) {
        // doc 07 §8: provider auth failure pauses claiming for 5 min.
        this.logPause(
          "auth",
          { pausedUntil: new Date(authUntil).toISOString() },
          "analysis worker paused: provider auth",
        );
        return 0;
      }
      const budgetPaused = state.budget.exceeded;
      // doc 07 §9: over the daily soft cap only manual runs are claimed.
      this.logPause(
        budgetPaused ? "budget" : "none",
        { spentTodayUsd: state.budget.spentTodayUsd, limitUsd: state.budget.limitUsd },
        budgetPaused ? "analysis worker budget_paused: only manual runs" : "analysis worker resumed",
      );
      const runs = await this.analysis.claimBatch(
        this.workerId,
        this.cfg.ANALYSIS_BATCH_SIZE,
        budgetPaused ? { triggers: ["manual"] } : {},
      );
      await runWithConcurrency(runs, this.cfg.ANALYSIS_CONCURRENCY, (run) => this.processOne(processor, run));
      return runs.length;
    } catch (error: unknown) {
      this.logger.error({ err: error }, "analysis worker tick failed");
      return 0;
    }
  }

  /** Logs once per pause-state transition. */
  private logPause(next: "none" | "auth" | "budget", data: Record<string, unknown>, msg: string): void {
    if (next === this.lastPauseLog) return;
    this.lastPauseLog = next;
    if (next === "budget") this.logger.warn(data, msg);
    else this.logger.info(data, msg);
  }

  private async processOne(processor: RunProcessor, run: ClaimedRun): Promise<void> {
    const w = this.workerId;
    const log = (e: unknown) => this.logger.error({ err: e, runId: run.id }, "analysis run transition failed");
    // Auth pause hit earlier in this batch: hand the run back without consuming the attempt.
    if (Date.now() < this.authPausedUntil) {
      await this.analysis.release(run.id, w).catch(log);
      return;
    }
    try {
      await processor.process(run);
    } catch (error: unknown) {
      if (error instanceof AnalysisLockLostError) {
        this.logger.warn({ runId: run.id }, "analysis run lock lost; left to its new holder");
        return;
      }
      const d = decideFailure(error);
      this.logger.warn({ runId: run.id, code: d.code, action: d.action }, "analysis run failed");
      if (d.action === "retry") {
        // FR-113: back off inside the slot, except on the last attempt (requeue then marks it failed).
        if (run.attemptCount < this.cfg.ANALYSIS_MAX_ATTEMPTS) await this.sleep(backoffMs(run.attemptCount, error));
        await this.analysis.requeue(run.id, w, d.code, d.message).catch(log);
        return;
      }
      await this.analysis.markFailed(run.id, w, d.code, d.message).catch(log);
      if (d.action === "fail_and_pause") {
        this.authPausedUntil = Date.now() + ANALYSIS_AUTH_PAUSE_MS;
        this.pause.invalidate();
        this.logger.error({ runId: run.id, code: d.code }, "analysis provider auth failed; worker paused");
      }
    }
  }
}
