import type { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../../config/config.module";
import { ANALYSIS_WORKER_INTERVAL, AnalysisWorkerService } from "./analysis-worker.service";
import type { AnalysisService, ClaimedRun } from "./analysis.service";
import type { RunProcessor } from "./run-processor";

function make(cfg: Partial<AppConfig>, processor?: RunProcessor) {
  const scheduler = { addInterval: jest.fn(), doesExist: jest.fn(() => false), deleteInterval: jest.fn() };
  const analysis = {
    requeueStuck: jest.fn(async () => ({ requeued: 0, failed: 0 })),
    claimBatch: jest.fn(async (): Promise<ClaimedRun[]> => []),
    requeue: jest.fn(async () => "pending"),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const full = {
    APP_ROLE: "all",
    NODE_ENV: "development",
    ANALYSIS_POLL_MS: 5000,
    ANALYSIS_BATCH_SIZE: 20,
    ANALYSIS_CONCURRENCY: 3,
    ...cfg,
  } as AppConfig;
  const svc = new AnalysisWorkerService(
    analysis as unknown as AnalysisService,
    scheduler as unknown as SchedulerRegistry,
    full,
    logger as unknown as PinoLogger,
    processor,
  );
  return { svc, scheduler, analysis };
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
  const run = (id: string) => ({ id }) as ClaimedRun;

  it("runs the watchdog before claiming and skips re-entrant ticks", async () => {
    const { svc, analysis } = make({}, proc);
    analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    const [n1, n2] = await Promise.all([svc.tick(), svc.tick()]);
    expect([n1, n2]).toEqual([1, 0]);
    expect(analysis.requeueStuck).toHaveBeenCalledTimes(1);
    expect(analysis.claimBatch).toHaveBeenCalledWith(svc.workerId, 20);
  });

  it("re-queues a run whose processor throws", async () => {
    const failing: RunProcessor = { process: jest.fn(async () => Promise.reject(new Error("boom"))) };
    const { svc, analysis } = make({}, failing);
    analysis.claimBatch.mockResolvedValueOnce([run("a")]);
    await svc.tick();
    expect(analysis.requeue).toHaveBeenCalledWith("a", svc.workerId, "ANALYSIS_PROVIDER_ERROR");
  });
});
