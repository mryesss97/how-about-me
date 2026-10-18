import type { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../../config/config.module";
import { ANALYSIS_WORKER_INTERVAL, AnalysisWorkerService } from "./analysis-worker.service";
import { ProviderError } from "../../common/errors/provider.error";
import { MetricsService } from "../../common/metrics/metrics.service";
import { ANALYSIS_AUTH_PAUSE_MS, AnalysisLockLostError } from "./analysis-failure-policy";
import type { AnalysisPauseService, AnalysisPauseState } from "./analysis-pause.service";
import type { AnalysisService, ClaimedRun } from "./analysis.service";
import type { RunProcessor } from "./run-processor";

function make(cfg: Partial<AppConfig>, processor?: RunProcessor) {
  const scheduler = { addInterval: jest.fn(), doesExist: jest.fn(() => false), deleteInterval: jest.fn() };
  const analysis = {
    requeueStuck: jest.fn(async () => ({ requeued: 0, failed: 0 })),
    claimBatch: jest.fn(async (): Promise<ClaimedRun[]> => []),
    requeue: jest.fn(async (): Promise<string | null> => "pending"),
    markFailed: jest.fn(async () => true),
    queueDepth: jest.fn(async () => ({ pending: 7, processing: 2 })),
    release: jest.fn(async () => true),
  };
  const state = (over: { exceeded?: boolean; pausedUntil?: Date | null } = {}): AnalysisPauseState => ({
    budget: {
      limitUsd: 5,
      spentTodayUsd: 0,
      exceeded: over.exceeded ?? false,
      dayStartUtc: new Date(0),
      resetsAt: new Date(0),
    },
    auth: { lastFailureAt: null, pausedUntil: over.pausedUntil ?? null },
  });
  const pause = { getState: jest.fn(async () => state()), invalidate: jest.fn() };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const full = {
    APP_ROLE: "all",
    NODE_ENV: "development",
    ANALYSIS_POLL_MS: 5000,
    ANALYSIS_BATCH_SIZE: 20,
    ANALYSIS_CONCURRENCY: 3,
    ANALYSIS_MAX_ATTEMPTS: 3,
    ...cfg,
  } as AppConfig;
  const metrics = new MetricsService();
  const svc = new AnalysisWorkerService(
    analysis as unknown as AnalysisService,
    scheduler as unknown as SchedulerRegistry,
    full,
    logger as unknown as PinoLogger,
    pause as unknown as AnalysisPauseService,
    metrics,
    processor,
  );
  const sleeps: number[] = [];
  svc.sleep = async (ms) => {
    sleeps.push(ms);
  };
  return { svc, scheduler, analysis, pause, state, sleeps, metrics };
}

const proc: RunProcessor = { process: jest.fn(async () => undefined) };

describe("AnalysisWorkerService role gating (FR-101, backend doc §6)", () => {
  afterEach(async () => jest.clearAllMocks());

  it("does not register the interval when APP_ROLE=api", () => {
    const { svc, scheduler } = make({ APP_ROLE: "api" }, proc);
    svc.onApplicationBootstrap();
    expect(scheduler.addInterval).not.toHaveBeenCalled();
  });

  it("does not register the interval without a RunProcessor (pre T-074)", () => {
    const { svc, scheduler } = make({ APP_ROLE: "worker" });
    svc.onApplicationBootstrap();
    expect(scheduler.addInterval).not.toHaveBeenCalled();
  });

  it("does not register the interval under NODE_ENV=test", () => {
    const { svc, scheduler } = make({ NODE_ENV: "test" }, proc);
    svc.onApplicationBootstrap();
    expect(scheduler.addInterval).not.toHaveBeenCalled();
  });

  it.each(["worker", "all"] as const)("registers the interval when APP_ROLE=%s", async (role) => {
    const { svc, scheduler } = make({ APP_ROLE: role }, proc);
    svc.onApplicationBootstrap();
    expect(scheduler.addInterval).toHaveBeenCalledWith(ANALYSIS_WORKER_INTERVAL, expect.anything());
    const handle = scheduler.addInterval.mock.calls[0]?.[1] as NodeJS.Timeout;
    clearInterval(handle);
  });
});

describe("AnalysisWorkerService.tick", () => {
  const run = (id: string, attemptCount = 1) => ({ id, attemptCount }) as ClaimedRun;
  const throwing = (...errs: unknown[]): RunProcessor => {
    const fn = jest.fn(async () => undefined);
    for (const e of errs) fn.mockRejectedValueOnce(e);
    return { process: fn };
  };

  it("runs the watchdog before claiming and skips re-entrant ticks", async () => {
    const { svc, analysis } = make({}, proc);
    analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    const [n1, n2] = await Promise.all([svc.tick(), svc.tick()]);
    expect([n1, n2]).toEqual([1, 0]);
    expect(analysis.requeueStuck).toHaveBeenCalledTimes(1);
    expect(analysis.claimBatch).toHaveBeenCalledWith(svc.workerId, 20, {});
  });

  it("FR-113: plain Error → backoff then requeue with INTERNAL", async () => {
    const { svc, analysis, sleeps } = make({}, throwing(new Error("boom")));
    analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await svc.tick();
    expect(sleeps).toEqual([4000]);
    expect(analysis.requeue).toHaveBeenCalledWith("a", svc.workerId, "INTERNAL", "unexpected_processor_error");
  });

  it("TC-ANA-016 / FR-113: retryable provider error → sleep(4000) then requeue with message", async () => {
    const { svc, analysis, sleeps } = make({}, throwing(new ProviderError("ANALYSIS_PROVIDER_ERROR", "OpenAI 429")));
    analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await svc.tick();
    expect(sleeps).toEqual([4000]);
    expect(analysis.requeue).toHaveBeenCalledWith("a", svc.workerId, "ANALYSIS_PROVIDER_ERROR", "OpenAI 429");
  });

  it("TC-ANA-017 / FR-113: last attempt → no sleep, requeue (→ failed)", async () => {
    const { svc, analysis, sleeps } = make({}, throwing(new ProviderError("ANALYSIS_PROVIDER_ERROR", "500")));
    analysis.claimBatch.mockResolvedValueOnce([run("a", 3)]);
    await svc.tick();
    expect(sleeps).toEqual([]);
    expect(analysis.requeue).toHaveBeenCalledTimes(1);
  });

  it.each(["ANALYSIS_SCHEMA_INVALID", "ANALYSIS_PROVIDER_BAD_REQUEST"] as const)(
    "TC-ANA-011 / FR-113: %s → markFailed, no requeue",
    async (code) => {
      const { svc, analysis, sleeps } = make({}, throwing(new ProviderError(code, "bad")));
      analysis.claimBatch.mockResolvedValueOnce([run("a")]);
      await svc.tick();
      expect(analysis.markFailed).toHaveBeenCalledWith("a", svc.workerId, code, "bad");
      expect(analysis.requeue).not.toHaveBeenCalled();
      expect(sleeps).toEqual([]);
    },
  );

  it("lock lost → only logged, no requeue / markFailed", async () => {
    const { svc, analysis } = make({}, throwing(new AnalysisLockLostError("a")));
    analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await svc.tick();
    expect(analysis.requeue).not.toHaveBeenCalled();
    expect(analysis.markFailed).not.toHaveBeenCalled();
  });

  it("doc 07 §8: auth → markFailed, rest of batch released, no claim for 5 min", async () => {
    const now = jest.spyOn(Date, "now");
    let t = 1_000_000;
    now.mockImplementation(() => t);
    try {
      const { svc, analysis, pause } = make(
        { ANALYSIS_CONCURRENCY: 1 },
        throwing(new ProviderError("ANALYSIS_PROVIDER_AUTH", "401")),
      );
      analysis.claimBatch.mockResolvedValueOnce([run("a"), run("b")]);
      await svc.tick();
      expect(analysis.markFailed).toHaveBeenCalledWith("a", svc.workerId, "ANALYSIS_PROVIDER_AUTH", "401");
      expect(analysis.release).toHaveBeenCalledWith("b", svc.workerId);
      expect(pause.invalidate).toHaveBeenCalled();
      expect(svc.pausedUntil?.getTime()).toBe(t + ANALYSIS_AUTH_PAUSE_MS);
      analysis.claimBatch.mockClear();
      await svc.tick();
      expect(analysis.claimBatch).not.toHaveBeenCalled();
      t += ANALYSIS_AUTH_PAUSE_MS + 1;
      await svc.tick();
      expect(analysis.claimBatch).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });

  it("doc 07 §8: DB auth signal in the future → no claim", async () => {
    const { svc, analysis, pause, state } = make({}, proc);
    pause.getState.mockResolvedValueOnce(state({ pausedUntil: new Date(Date.now() + 60_000) }));
    await svc.tick();
    expect(analysis.claimBatch).not.toHaveBeenCalled();
  });

  it("TC-ANA-022 / doc 07 §9: budget exceeded → claim only manual runs", async () => {
    const { svc, analysis, pause, state } = make({}, proc);
    pause.getState.mockResolvedValueOnce(state({ exceeded: true }));
    await svc.tick();
    expect(analysis.claimBatch).toHaveBeenCalledWith(svc.workerId, 20, { triggers: ["manual"] });
  });
});

describe("AnalysisWorkerService backoff sleep (FR-113)", () => {
  it("shutdown wakes a pending backoff sleep so the run is requeued before exit", async () => {
    jest.useFakeTimers();
    try {
      const svc = new AnalysisWorkerService(
        {} as AnalysisService,
        { doesExist: jest.fn(() => false) } as unknown as SchedulerRegistry,
        {} as AppConfig,
        { info: jest.fn() } as unknown as PinoLogger,
        {} as AnalysisPauseService,
        new MetricsService(),
      );
      let woke = false;
      const sleeping = svc.sleep(30_000).then(() => (woke = true));
      await svc.beforeApplicationShutdown();
      await sleeping;
      expect(woke).toBe(true);
      // After shutdown new sleeps return immediately.
      await svc.sleep(30_000);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("AnalysisWorkerService metrics (FR-174, #310)", () => {
  const run = (id: string) => ({ id, attemptCount: 1, trigger: "ingest" }) as ClaimedRun;
  const failing = (e: unknown): RunProcessor => ({ process: jest.fn(async () => Promise.reject(e)) });
  const retryErr = () => new ProviderError("ANALYSIS_PROVIDER_ERROR", "500");

  it.each([
    ["pending", 'analysis_runs_total{status="retried",trigger="ingest"} 1'],
    ["failed", 'analysis_runs_total{status="failed",trigger="ingest"} 1'],
  ] as const)("FR-113: requeue → %s is counted", async (st, line) => {
    const m = make({}, failing(retryErr()));
    m.analysis.requeue.mockResolvedValueOnce(st);
    m.analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await m.svc.tick();
    const text = await m.metrics.render();
    expect(text).toContain(line);
    expect(text).toContain('analysis_run_duration_ms_count{step="total"} 1');
  });

  it("requeue lost the lock (null) → not counted", async () => {
    const m = make({}, failing(retryErr()));
    m.analysis.requeue.mockResolvedValueOnce(null);
    m.analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await m.svc.tick();
    expect(await m.metrics.render()).not.toContain("analysis_runs_total{");
  });

  it("ANALYSIS_SCHEMA_INVALID → failed", async () => {
    const m = make({}, failing(new ProviderError("ANALYSIS_SCHEMA_INVALID", "bad")));
    m.analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await m.svc.tick();
    expect(await m.metrics.render()).toContain('analysis_runs_total{status="failed",trigger="ingest"} 1');
  });

  it("markFailed false → not counted", async () => {
    const m = make({}, failing(new ProviderError("ANALYSIS_SCHEMA_INVALID", "bad")));
    m.analysis.markFailed.mockResolvedValueOnce(false);
    m.analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await m.svc.tick();
    expect(await m.metrics.render()).not.toContain("analysis_runs_total{");
  });

  it("lock lost → nothing counted, no total histogram", async () => {
    const m = make({}, failing(new AnalysisLockLostError("a")));
    m.analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await m.svc.tick();
    const text = await m.metrics.render();
    expect(text).not.toContain("analysis_runs_total{");
    expect(text).not.toContain('step="total"');
  });

  it("tick sets queue depth, also while auth-paused", async () => {
    const m = make({}, proc);
    m.pause.getState.mockResolvedValueOnce(m.state({ pausedUntil: new Date(Date.now() + 60_000) }));
    await m.svc.tick();
    const text = await m.metrics.render();
    expect(text).toContain('analysis_queue_depth{status="pending"} 7');
    expect(text).toContain('analysis_queue_depth{status="processing"} 2');
  });

  it("queueDepth failure does not break the tick", async () => {
    const m = make({}, proc);
    m.analysis.queueDepth.mockRejectedValueOnce(new Error("db"));
    m.analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    expect(await m.svc.tick()).toBe(1);
  });
});
