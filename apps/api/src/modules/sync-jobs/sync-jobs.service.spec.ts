import type { SyncJob as SyncJobRow } from "@prisma/client";
import type { AuthUser } from "../../common/auth/current-user.decorator";
import type { AppConfig } from "../../config/config.module";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { RunNowThrottle } from "./run-now-throttle";
import {
  type RetrySource,
  type RunnableQuery,
  type SyncJobsRepository,
  toSyncJob,
  toSyncJobDetail,
} from "./sync-jobs.repository";
import { SyncJobsService } from "./sync-jobs.service";

const PID = "00000000-0000-7000-8000-000000000001";
const QID = "00000000-0000-7000-8000-000000000002";
const JID = "00000000-0000-7000-8000-000000000003";
const ctx = { projectId: PID, user: { id: "u-admin" } as AuthUser, requestId: "req-1" };

const source = (over: Partial<RetrySource> = {}): RetrySource => ({
  id: JID,
  projectId: PID,
  queryId: QID,
  status: "failed",
  trigger: "scheduled",
  searchType: "RECENT",
  searchMode: "KEYWORD",
  windowSince: new Date("2026-10-01T00:00:00Z"),
  windowUntil: new Date("2026-10-02T00:00:00Z"),
  lastCursor: "cur-7",
  ...over,
});

function setup(
  src: RetrySource | null,
  opts: { runnable?: boolean; active?: string | null; query?: RunnableQuery | null } = {},
) {
  const repo = {
    findRetrySourceTx: jest.fn().mockResolvedValue(src),
    lockQueryRunnableTx: jest.fn().mockResolvedValue(opts.runnable ?? true),
    findActiveForQueryTx: jest.fn().mockResolvedValue(opts.active ?? null),
    createRetryTx: jest.fn().mockResolvedValue("new-job"),
    findRunnableQueryTx: jest
      .fn()
      .mockResolvedValue(
        opts.query === undefined ? { id: QID, enabled: true, deleted: false, searchMode: "KEYWORD" } : opts.query,
      ),
    createManualTx: jest.fn().mockResolvedValue("manual-job"),
    createBackfillTx: jest.fn().mockResolvedValue("backfill-job"),
  };
  const throttle = { assertAllowed: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const tx = {};
  const prisma = { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };
  const svc = new SyncJobsService(
    prisma as unknown as PrismaService,
    repo as unknown as SyncJobsRepository,
    audit as unknown as AuditService,
    throttle as unknown as RunNowThrottle,
    { COLLECTOR_MAX_BACKFILL_DAYS: 30 } as AppConfig,
  );
  return { svc, repo, audit, tx, throttle };
}

/** FR-175 / TC-SYS-011: admin retry of a sync job. */
describe("SyncJobsService.retry (FR-175)", () => {
  it.each(["failed", "partial"] as const)("%s job → queued retry copying cursor + window, audited", async (status) => {
    const src = source({ status });
    const { svc, repo, audit, tx } = setup(src);
    await expect(svc.retry(ctx, JID)).resolves.toEqual({ jobId: "new-job", status: "queued" });
    expect(repo.createRetryTx).toHaveBeenCalledWith(tx, src, "u-admin");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sync_job.retry_requested",
        entityType: "sync_job",
        entityId: "new-job",
        metadata: { sourceJobId: JID, queryId: QID },
        requestId: "req-1",
      }),
      tx,
    );
  });

  it("unknown / other-project job → NOT_FOUND", async () => {
    await expect(setup(null).svc.retry(ctx, JID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each(["success", "running", "queued", "cancelled"] as const)("%s job → SYNC_JOB_NOT_RETRYABLE", async (status) => {
    const { svc, repo } = setup(source({ status }));
    await expect(svc.retry(ctx, JID)).rejects.toMatchObject({ code: "SYNC_JOB_NOT_RETRYABLE", status: 409 });
    expect(repo.createRetryTx).not.toHaveBeenCalled();
  });

  it("hard-deleted query (query_id null) → SYNC_JOB_NOT_RETRYABLE", async () => {
    await expect(setup(source({ queryId: null })).svc.retry(ctx, JID)).rejects.toMatchObject({
      code: "SYNC_JOB_NOT_RETRYABLE",
    });
  });

  it("BR-010: disabled/soft-deleted query → SYNC_JOB_NOT_RETRYABLE", async () => {
    const { svc, repo } = setup(source(), { runnable: false });
    await expect(svc.retry(ctx, JID)).rejects.toMatchObject({ code: "SYNC_JOB_NOT_RETRYABLE" });
    expect(repo.createRetryTx).not.toHaveBeenCalled();
  });

  it("query already has a queued/running job → SYNC_ALREADY_RUNNING with jobId", async () => {
    const { svc } = setup(source(), { active: "busy-job" });
    await expect(svc.retry(ctx, JID)).rejects.toMatchObject({
      code: "SYNC_ALREADY_RUNNING",
      details: { jobId: "busy-job" },
    });
  });
});

/** T-043 / FR-058 / TC-LQ-013..015: run-now. */
describe("SyncJobsService.runNow (FR-058)", () => {
  it("TC-LQ-013: queues a manual job and audits query.run_requested (BR-034)", async () => {
    const { svc, repo, audit, tx, throttle } = setup(null);
    await expect(svc.runNow(ctx, QID)).resolves.toEqual({ jobId: "manual-job", status: "queued" });
    expect(throttle.assertAllowed).toHaveBeenCalledWith(tx, PID);
    expect(repo.createManualTx).toHaveBeenCalledWith(
      tx,
      { projectId: PID, queryId: QID, searchMode: "KEYWORD" },
      "u-admin",
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "query.run_requested",
        entityType: "listening_query",
        entityId: QID,
        metadata: { jobId: "manual-job" },
      }),
      tx,
    );
  });

  it("TC-LQ-014: active job → SYNC_ALREADY_RUNNING with jobId, no insert/audit", async () => {
    const { svc, repo, audit } = setup(null, { active: "busy" });
    await expect(svc.runNow(ctx, QID)).rejects.toMatchObject({
      code: "SYNC_ALREADY_RUNNING",
      details: { jobId: "busy" },
    });
    expect(repo.createManualTx).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("unknown / other-project query → NOT_FOUND", async () => {
    await expect(setup(null, { query: null }).svc.runNow(ctx, QID)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("BR-010: soft-deleted → NOT_FOUND; disabled → VALIDATION_ERROR", async () => {
    const del = setup(null, { query: { id: QID, enabled: true, deleted: true, searchMode: "KEYWORD" } });
    await expect(del.svc.runNow(ctx, QID)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const dis = setup(null, { query: { id: QID, enabled: false, deleted: false, searchMode: "KEYWORD" } });
    await expect(dis.svc.runNow(ctx, QID)).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(dis.repo.createManualTx).not.toHaveBeenCalled();
  });

  it("NFR-017: throttle error propagates before locking the query", async () => {
    const { svc, repo, throttle } = setup(null);
    throttle.assertAllowed.mockRejectedValue(Object.assign(new Error("x"), { code: "RATE_LIMITED" }));
    await expect(svc.runNow(ctx, QID)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(repo.findRunnableQueryTx).not.toHaveBeenCalled();
  });
});

const row = (over: Partial<SyncJobRow> = {}): SyncJobRow =>
  ({
    id: JID,
    projectId: PID,
    queryId: QID,
    status: "failed",
    trigger: "scheduled",
    searchType: "RECENT",
    searchMode: "KEYWORD",
    windowSince: null,
    windowUntil: null,
    startedAt: null,
    completedAt: null,
    pagesFetched: 1,
    recordsFetched: 2,
    recordsInserted: 1,
    recordsUpdated: 0,
    recordsDuplicated: 1,
    recordsInvalid: 0,
    recordsExcluded: 0,
    providerRequests: 3,
    rateLimitEvents: 0,
    providerUsage: null,
    lastCursor: "c",
    errorCode: null,
    errorMessage: null,
    requestedBy: "u",
    lockedBy: "w",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  }) as SyncJobRow;

describe("sync job mappers (FR-081)", () => {
  it("error is null without errorCode, object with it; no internal fields leak", () => {
    const ok = toSyncJob(row());
    expect(ok.error).toBeNull();
    expect(ok).not.toHaveProperty("lockedBy");
    expect(ok).not.toHaveProperty("requestedBy");
    expect(toSyncJob(row({ errorCode: "RATE_LIMITED", errorMessage: "slow" })).error).toEqual({
      code: "RATE_LIMITED",
      message: "slow",
    });
  });

  it("detail exposes providerUsage without raw headers", () => {
    const d = toSyncJobDetail(
      row({ providerUsage: { remaining: 5, resetAt: null, observedAt: "2026-10-01T00:00:00.000Z", raw: { a: "b" } } }),
    );
    expect(d.providerUsage).toEqual({ remaining: 5, resetAt: null, observedAt: "2026-10-01T00:00:00.000Z" });
    expect(toSyncJobDetail(row()).providerUsage).toBeNull();
  });
});

/** T-140 / FR-063 / TC-LQ-022: admin backfill. */
describe("SyncJobsService.backfill (FR-063)", () => {
  const body = { since: "2026-08-01T00:00:00Z", until: "2026-08-20T00:00:00+07:00", searchType: "TOP" as const };

  it("valid window → queued backfill job + audit in the same tx, no run-now throttle", async () => {
    const { svc, repo, audit, tx, throttle } = setup(null);
    await expect(svc.backfill(ctx, QID, body)).resolves.toEqual({ jobId: "backfill-job", status: "queued" });
    expect(repo.createBackfillTx).toHaveBeenCalledWith(
      tx,
      {
        projectId: PID,
        queryId: QID,
        searchMode: "KEYWORD",
        searchType: "TOP",
        windowSince: new Date("2026-08-01T00:00:00Z"),
        windowUntil: new Date("2026-08-19T17:00:00Z"),
      },
      "u-admin",
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "query.backfill_requested",
        entityType: "listening_query",
        entityId: QID,
        metadata: {
          jobId: "backfill-job",
          since: "2026-08-01T00:00:00.000Z",
          until: "2026-08-19T17:00:00.000Z",
          searchType: "TOP",
        },
      }),
      tx,
    );
    expect(throttle.assertAllowed).not.toHaveBeenCalled();
  });

  it("invalid window → BACKFILL_WINDOW_INVALID before any DB work", async () => {
    const { svc, repo } = setup(null);
    await expect(svc.backfill(ctx, QID, { ...body, until: body.since })).rejects.toMatchObject({
      code: "BACKFILL_WINDOW_INVALID",
    });
    expect(repo.findRunnableQueryTx).not.toHaveBeenCalled();
  });

  it("BR-010: deleted/missing → 404, disabled → 400", async () => {
    await expect(setup(null, { query: null }).svc.backfill(ctx, QID, body)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const deleted = { id: QID, enabled: true, deleted: true, searchMode: "KEYWORD" as const };
    await expect(setup(null, { query: deleted }).svc.backfill(ctx, QID, body)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const disabled = { id: QID, enabled: false, deleted: false, searchMode: "KEYWORD" as const };
    await expect(setup(null, { query: disabled }).svc.backfill(ctx, QID, body)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("active job → 409 SYNC_ALREADY_RUNNING, nothing created", async () => {
    const { svc, repo, audit } = setup(null, { active: "j-active" });
    await expect(svc.backfill(ctx, QID, body)).rejects.toMatchObject({
      code: "SYNC_ALREADY_RUNNING",
      details: { jobId: "j-active" },
    });
    expect(repo.createBackfillTx).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
