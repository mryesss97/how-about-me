import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { SyncJobRecorder } from "./sync-job.recorder";
import { SyncJobsController } from "./sync-jobs.controller";
import { SyncJobsRepository } from "./sync-jobs.repository";
import { SyncJobsService } from "./sync-jobs.service";

/** `sync_jobs` persistence (T-052) + list/detail/retry endpoints (T-055). */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SyncJobsController],
  providers: [SyncJobRecorder, SyncJobsRepository, SyncJobsService],
  exports: [SyncJobRecorder],
})
export class SyncJobsModule {}
