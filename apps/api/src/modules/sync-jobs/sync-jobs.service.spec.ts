import type { SyncJob as SyncJobRow } from "@prisma/client";
import type { AuthUser } from "../../common/auth/current-user.decorator";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import { type RetrySource, type SyncJobsRepository, toSyncJob, toSyncJobDetail } from "./sync-jobs.repository";
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
  searchType: "RECENT",
  searchMode: "KEYWORD",
  windowSince: new Date("2026-10-01T00:00:00Z"),
  windowUntil: new Date("2026-10-02T00:00:00Z"),
  lastCursor: "cur-7",
  ...over,
});

function setup(src: RetrySource | null, opts: { runnable?: boolean; active?: string | null } = {}) {
  const repo = {
    findRetrySourceTx: jest.fn().mockResolvedValue(src),
    lockQueryRunnableTx: jest.fn().mockResolvedValue(opts.runnable ?? true),
    findActiveForQueryTx: jest.fn().mockResolvedValue(opts.active ?? null),
    createRetryTx: jest.fn().mockResolvedValue("new-job"),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const tx = {};
  const prisma = { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };
  const svc = new SyncJobsService(
    prisma as unknown as PrismaService,
    repo as unknown as SyncJobsRepository,
    audit as unknown as AuditService,
  );
  return { svc, repo, audit, tx };
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
