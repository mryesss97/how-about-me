import { Injectable } from "@nestjs/common";
import type { SyncJobDetail, SyncJobsListQuery } from "@how-about-me/contracts";
import type { AuthUser } from "../../common/auth/current-user.decorator";
import { AppError } from "../../common/errors/app.error";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { type SyncJobsPage, SyncJobsRepository } from "./sync-jobs.repository";

type Ctx = { projectId: string; user: AuthUser; requestId: string | null };

const RETRYABLE = new Set(["failed", "partial"]);

/** Sync jobs list/detail (FR-081) and admin retry (FR-175). Membership/role enforced by guards (FR-015). */
@Injectable()
export class SyncJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: SyncJobsRepository,
    private readonly audit: AuditService,
  ) {}

  list(projectId: string, q: SyncJobsListQuery): Promise<SyncJobsPage> {
    return this.repo.list(projectId, q);
  }

  async get(projectId: string, id: string): Promise<SyncJobDetail> {
    const job = await this.repo.findById(projectId, id);
    if (!job) throw AppError.notFound("Sync job");
    return job;
  }

  /**
   * FR-175 / TC-SYS-011: queues a `retry` job that resumes from the failed/partial job's `last_cursor`.
   * The source job is never modified (append-only history). BR-010: disabled/deleted queries are not run.
   */
  async retry(ctx: Ctx, jobId: string): Promise<{ jobId: string; status: "queued" }> {
    return this.prisma.$transaction(async (tx) => {
      const src = await this.repo.findRetrySourceTx(tx, ctx.projectId, jobId);
      if (!src) throw AppError.notFound("Sync job");
      if (!RETRYABLE.has(src.status)) {
        throw new AppError("SYNC_JOB_NOT_RETRYABLE", `Sync job with status ${src.status} cannot be retried`);
      }
      if (!src.queryId) throw new AppError("SYNC_JOB_NOT_RETRYABLE", "Listening query no longer exists");
      if (!(await this.repo.lockQueryRunnableTx(tx, src.queryId))) {
        throw new AppError("SYNC_JOB_NOT_RETRYABLE", "Listening query is disabled or deleted");
      }
      const active = await this.repo.findActiveForQueryTx(tx, src.queryId);
      if (active)
        throw new AppError("SYNC_ALREADY_RUNNING", "A sync job is already queued or running", { jobId: active });
      const newId = await this.repo.createRetryTx(tx, { ...src, queryId: src.queryId }, ctx.user.id);
      await this.audit.record(
        {
          projectId: ctx.projectId,
          actorUserId: ctx.user.id,
          action: "sync_job.retry_requested",
          entityType: "sync_job",
          entityId: newId,
          metadata: { sourceJobId: src.id, queryId: src.queryId },
          requestId: ctx.requestId,
        },
        tx,
      );
      return { jobId: newId, status: "queued" as const };
    });
  }
}
