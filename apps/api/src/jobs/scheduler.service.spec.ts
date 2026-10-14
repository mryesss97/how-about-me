import type { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import { AppError } from "../common/errors/app.error";
import type { AppConfig } from "../config/config.module";
import type { ClaimedQuery, CollectorRunner, RunOutcome } from "./collector-runner";
import type { QueryClaimRepository } from "./query-claim.repository";
import { COLLECTOR_TICK_INTERVAL, SchedulerService } from "./scheduler.service";

const q = (id: string): ClaimedQuery => ({
  id,
  projectId: "p",
  pollIntervalSeconds: 600,
  consecutiveFailures: 0,
  nextRunAt: null,
  manualJobId: null,
});

function setup(role: AppConfig["APP_ROLE"], runner: CollectorRunner | null, claimed: ClaimedQuery[], limit = 3) {
  const cfg = {
    APP_ROLE: role,
    COLLECTOR_TICK_MS: 60_000,
    COLLECTOR_MAX_CONCURRENT_QUERIES: limit,
    COLLECTOR_LOCK_STALE_MINUTES: 15,
  } as AppConfig;
  const repo = {
    claimDueQueries: jest.fn().mockResolvedValue(claimed),
    completeRun: jest.fn().mockResolvedValue(1),
    releaseLocks: jest.fn().mockResolvedValue(0),
  };
  const registry = { addInterval: jest.fn(), doesExist: jest.fn().mockReturnValue(false), deleteInterval: jest.fn() };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const svc = new SchedulerService(
    cfg,
    runner,
    repo as unknown as QueryClaimRepository,
    registry as unknown as SchedulerRegistry,
    logger as unknown as PinoLogger,
  );
  return { svc, repo, registry };
}

const ok = (): Promise<RunOutcome> => Promise.resolve({ status: "success", completedAt: new Date() });

describe("SchedulerService (FR-070, FR-086)", () => {
  it("role api never registers the tick interval", () => {
    const { svc, registry } = setup("api", { run: ok }, []);
    svc.onModuleInit();
    expect(registry.addInterval).not.toHaveBeenCalled();
  });

  it.each(["worker", "all"] as const)("role %s registers the tick interval", (role) => {
    const { svc, registry } = setup(role, { run: ok }, []);
    svc.onModuleInit();
    expect(registry.addInterval).toHaveBeenCalledWith(COLLECTOR_TICK_INTERVAL, expect.anything());
    clearInterval(registry.addInterval.mock.calls[0][1] as NodeJS.Timeout);
  });

  it("without a bound runner (before T-052) never registers the tick nor claims", async () => {
    const { svc, registry, repo } = setup("all", null, [q("a")]);
    svc.onModuleInit();
    await svc.tick();
    expect(registry.addInterval).not.toHaveBeenCalled();
    expect(repo.claimDueQueries).not.toHaveBeenCalled();
  });

  it("a throwing runner marks only that query failed; others still complete", async () => {
    const runner: CollectorRunner = {
      run: (query) => (query.id === "b" ? Promise.reject(new AppError("THREADS_TIMEOUT", "slow")) : ok()),
    };
    const { svc, repo } = setup("all", runner, [q("a"), q("b"), q("c")]);
    await svc.tick();
    expect(repo.completeRun).toHaveBeenCalledTimes(3);
    const failed = repo.completeRun.mock.calls.find((c) => c[0] === "b")?.[2];
    expect(failed).toMatchObject({ consecutiveFailures: 1, error: { code: "THREADS_TIMEOUT", message: "slow" } });
    const good = repo.completeRun.mock.calls.find((c) => c[0] === "a")?.[2];
    expect(good).toMatchObject({ consecutiveFailures: 0, error: undefined });
  });

  it("non-AppError throw is recorded as INTERNAL", async () => {
    const { svc, repo } = setup("all", { run: () => Promise.reject(new Error("boom")) }, [q("a")]);
    await svc.tick();
    expect(repo.completeRun.mock.calls[0][2]).toMatchObject({ error: { code: "INTERNAL", message: "boom" } });
  });

  it("concurrency never exceeds COLLECTOR_MAX_CONCURRENT_QUERIES", async () => {
    let inFlight = 0;
    let peak = 0;
    const runner: CollectorRunner = {
      run: async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return { status: "success", completedAt: new Date() };
      },
    };
    const { svc, repo } = setup("all", runner, ["a", "b", "c", "d", "e"].map(q), 2);
    await svc.tick();
    expect(peak).toBe(2);
    expect(repo.completeRun).toHaveBeenCalledTimes(5);
  });

  it("overlapping ticks in one instance do not claim twice", async () => {
    let release: () => void = () => undefined;
    const runner: CollectorRunner = {
      run: () => new Promise((r) => (release = () => r({ status: "success", completedAt: new Date() }))),
    };
    const { svc, repo } = setup("all", runner, [q("a")]);
    const first = svc.tick();
    const second = svc.tick();
    await new Promise((r) => setImmediate(r));
    release();
    await Promise.all([first, second]);
    expect(repo.claimDueQueries).toHaveBeenCalledTimes(1);
  });

  it("claim failure does not throw out of tick", async () => {
    const { svc, repo } = setup("all", { run: ok }, []);
    repo.claimDueQueries.mockRejectedValueOnce(new Error("db down"));
    await expect(svc.tick()).resolves.toBeUndefined();
  });

  it("shutdown releases this worker's locks", async () => {
    const { svc, repo } = setup("all", { run: ok }, []);
    await svc.beforeApplicationShutdown();
    expect(repo.releaseLocks).toHaveBeenCalledWith(svc.workerId);
  });
});
