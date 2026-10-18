import { Injectable } from "@nestjs/common";
import { Prisma, type SearchMode, type SearchType } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { PrismaService } from "../../database/prisma.service";

const MAX_ERROR_MESSAGE_LENGTH = 1_000;

/** `sync_jobs.provider_usage` — snapshot of the last page that carried rate-limit info (doc 06 §9, FR-089). */
export type ProviderUsage = {
  remaining: number | null;
  resetAt: string | null;
  raw: Record<string, string>;
  observedAt: string;
};

export type StartJobInput = {
  projectId: string;
  queryId: string;
  /** Queued manual/retry job to take over; when absent (or already taken) a scheduled job is created. */
  queuedJobId: string | null;
  searchType: SearchType;
  searchMode: SearchMode;
  windowSince: Date;
  windowUntil: Date;
  workerId: string;
};

export type StartedJob = {
  id: string;
  /** Window stored on a queued job (manual backfill / retry) — wins over the computed one. */
  windowSince: Date | null;
  windowUntil: Date | null;
  /** Resume cursor copied onto a retry job (TC-COL-008). */
  lastCursor: string | null;
};

export type PageDelta = {
  fetched: number;
  inserted: number;
  updated: number;
  duplicated: number;
  invalid: number;
  excluded: number;
  providerRequests: number;
  rateLimitEvents: number;
  providerUsage: ProviderUsage | null;
  lastCursor: string | null;
};

export type FinishJobInput = {
  status: "success" | "partial" | "failed";
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
};

/** `sync_jobs` lifecycle writes for one collector run — docs/02-architecture/06-ingestion-pipeline.md §5 (T-052). */
@Injectable()
export class SyncJobRecorder {
  constructor(private readonly prisma: PrismaService) {}

  async start(input: StartJobInput): Promise<StartedJob> {
    const startedAt = new Date();
    if (input.queuedJobId) {
      // Guarded take-over: only a still-queued job moves to running (a cancelled one stays cancelled).
      const taken = await this.prisma.syncJob.updateMany({
        where: { id: input.queuedJobId, status: "queued" },
        data: { status: "running", startedAt, lockedBy: input.workerId },
      });
      if (taken.count === 1) {
        const job = await this.prisma.syncJob.findUniqueOrThrow({
          where: { id: input.queuedJobId },
          select: { id: true, windowSince: true, windowUntil: true, lastCursor: true },
        });
        const windowSince = job.windowSince ?? input.windowSince;
        const windowUntil = job.windowUntil ?? input.windowUntil;
        await this.prisma.syncJob.update({ where: { id: job.id }, data: { windowSince, windowUntil } });
        return { id: job.id, windowSince: job.windowSince, windowUntil: job.windowUntil, lastCursor: job.lastCursor };
      }
    }
    const id = uuidv7();
    await this.prisma.syncJob.create({
      data: {
        id,
        projectId: input.projectId,
        queryId: input.queryId,
        status: "running",
        trigger: "scheduled",
        searchType: input.searchType,
        searchMode: input.searchMode,
        windowSince: input.windowSince,
        windowUntil: input.windowUntil,
        startedAt,
        lockedBy: input.workerId,
      },
    });
    return { id, windowSince: null, windowUntil: null, lastCursor: null };
  }

  /** Adds one committed page; called inside the page's ingestion transaction (doc 06 §5). */
  async recordPageTx(tx: Prisma.TransactionClient, jobId: string, d: PageDelta): Promise<void> {
    await tx.syncJob.update({
      where: { id: jobId },
      data: {
        pagesFetched: { increment: 1 },
        recordsFetched: { increment: d.fetched },
        recordsInserted: { increment: d.inserted },
        recordsUpdated: { increment: d.updated },
        recordsDuplicated: { increment: d.duplicated },
        recordsInvalid: { increment: d.invalid },
        recordsExcluded: { increment: d.excluded },
        providerRequests: { increment: d.providerRequests },
        rateLimitEvents: { increment: d.rateLimitEvents },
        lastCursor: d.lastCursor,
        ...(d.providerUsage ? { providerUsage: d.providerUsage } : {}),
      },
    });
  }

  /** Provider attempts of a page that never committed still cost quota (FR-089). */
  async recordFailedAttempts(jobId: string, providerRequests: number, rateLimitEvents: number): Promise<void> {
    if (providerRequests === 0 && rateLimitEvents === 0) return;
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        providerRequests: { increment: providerRequests },
        rateLimitEvents: { increment: rateLimitEvents },
      },
    });
  }

  async finish(jobId: string, input: FinishJobInput): Promise<void> {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: input.status,
        completedAt: new Date(),
        lockedBy: null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage?.slice(0, MAX_ERROR_MESSAGE_LENGTH) ?? null,
      },
    });
  }
}
