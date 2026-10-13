import type { SchedulerRegistry } from "@nestjs/schedule";
import type { CronJob } from "cron";
import type { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../config/config.module";
import type { PrismaService } from "../database/prisma.service";
import type { AuditService } from "../modules/audit/audit.service";
import { applyPurge, countPurge, type PurgeScope } from "../modules/retention/purge";
import { RETENTION_CRON_JOB, RetentionJobService } from "./retention-job.service";

jest.mock("../modules/retention/purge", () => ({ countPurge: jest.fn(), applyPurge: jest.fn() }));
const countMock = countPurge as jest.MockedFunction<typeof countPurge>;
const applyMock = applyPurge as jest.MockedFunction<typeof applyPurge>;

const NOW = new Date("2026-10-13T20:00:00Z");

function setup(over: Partial<AppConfig> = {}, projects = ["p1", "p2"]) {
  const cfg = {
    NODE_ENV: "development",
    APP_ROLE: "worker",
    RETENTION_JOB_MODE: "dry-run",
    RETENTION_JOB_CRON: "0 3 * * 0",
    RETENTION_JOB_TIMEZONE: "Asia/Ho_Chi_Minh",
    RETENTION_POSTS_DAYS: 365,
    RETENTION_RUNS_DAYS: 365,
    RETENTION_SYNC_JOBS_DAYS: 180,
    ...over,
  } as AppConfig;
  const prisma = { monitoringProject: { findMany: jest.fn().mockResolvedValue(projects.map((id) => ({ id }))) } };
  const registry = {
    addCronJob: jest.fn(),
    doesExist: jest.fn().mockReturnValue(false),
    getCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
  };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const audit = {} as AuditService;
  const svc = new RetentionJobService(
    cfg,
    prisma as unknown as PrismaService,
    audit,
    registry as unknown as SchedulerRegistry,
    logger as unknown as PinoLogger,
  );
  return { svc, registry, logger, audit };
}

beforeEach(() => {
  countMock.mockReset().mockResolvedValue({ syncJobs: 2 });
  applyMock.mockReset().mockResolvedValue({ syncJobs: 2 });
});

describe("RetentionJobService registration (T-153, NFR-054)", () => {
  it("mode off never registers the cron", () => {
    const { svc, registry } = setup({ RETENTION_JOB_MODE: "off" });
    svc.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it("role api never registers the cron", () => {
    const { svc, registry } = setup({ APP_ROLE: "api" });
    svc.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it("NODE_ENV test never registers the cron", () => {
    const { svc, registry } = setup({ NODE_ENV: "test" });
    svc.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it.each(["worker", "all"] as const)("role %s registers the cron and stops it on shutdown", async (role) => {
    const { svc, registry } = setup({ APP_ROLE: role });
    svc.onModuleInit();
    expect(registry.addCronJob).toHaveBeenCalledWith(RETENTION_CRON_JOB, expect.anything());
    const job = registry.addCronJob.mock.calls[0][1] as CronJob;
    registry.doesExist.mockReturnValue(true);
    registry.getCronJob.mockReturnValue(job);
    await svc.onApplicationShutdown();
    expect(job.isActive).toBe(false);
    expect(registry.deleteCronJob).toHaveBeenCalledWith(RETENTION_CRON_JOB);
  });
});

describe("RetentionJobService.run (T-153, NFR-054)", () => {
  it("dry-run counts every scope and never deletes", async () => {
    const { svc, logger } = setup({ RETENTION_JOB_MODE: "dry-run" });
    await svc.run(NOW);
    const scopes = countMock.mock.calls.map((c) => (c[1] as PurgeScope).scope);
    expect(scopes).toEqual(["project", "runs", "project", "runs", "sync-jobs"]);
    expect(applyMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ counts: { syncJobs: 2 } }), "retention dry-run");
  });

  it("apply counts then deletes each scope with one requestId and a null actor", async () => {
    const { svc, audit } = setup({ RETENTION_JOB_MODE: "apply" }, ["p1"]);
    await svc.run(NOW);
    expect(applyMock).toHaveBeenCalledTimes(3);
    const ids = new Set(applyMock.mock.calls.map((c) => c[3]?.requestId));
    expect(ids.size).toBe(1);
    for (const c of applyMock.mock.calls) {
      expect(c[1]).toBe(audit);
      expect(c[3]?.actorUserId).toBeNull();
    }
    // Dry-run count always precedes the delete.
    expect(countMock.mock.invocationCallOrder[0]).toBeLessThan(applyMock.mock.invocationCallOrder[0] ?? 0);
  });

  it("apply skips scopes with nothing to delete", async () => {
    countMock.mockResolvedValue({ syncJobs: 0 });
    const { svc } = setup({ RETENTION_JOB_MODE: "apply" });
    await svc.run(NOW);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("a failing scope is logged and the next scope still runs", async () => {
    countMock.mockRejectedValueOnce(new Error("boom"));
    const { svc, logger } = setup({ RETENTION_JOB_MODE: "apply" }, ["p1"]);
    await svc.run(NOW);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ scope: "project" }), "retention scope failed");
    expect(applyMock).toHaveBeenCalledTimes(2);
  });

  it("overlapping calls run only once", async () => {
    const { svc } = setup({}, []);
    await Promise.all([svc.run(NOW), svc.run(NOW)]);
    expect(countMock).toHaveBeenCalledTimes(1);
  });
});
