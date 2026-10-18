import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { RunNowThrottle } from "./run-now-throttle";
import { SyncJobRecorder } from "./sync-job.recorder";
import { SyncJobsController } from "./sync-jobs.controller";
import { SyncJobsRepository } from "./sync-jobs.repository";
import { SyncJobsService } from "./sync-jobs.service";

/** `sync_jobs` persistence (T-052) + list/detail/retry endpoints (T-055) + run-now (T-043). */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SyncJobsController],
  providers: [SyncJobRecorder, SyncJobsRepository, SyncJobsService, RunNowThrottle],
  exports: [SyncJobRecorder, SyncJobsService],
})
export class SyncJobsModule {}
