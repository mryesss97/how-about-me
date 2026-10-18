import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { SyncJobRecorder } from "./sync-job.recorder";

/** `sync_jobs` persistence (T-052); list/detail/retry endpoints come in T-055. */
@Module({
  imports: [PrismaModule],
  providers: [SyncJobRecorder],
  exports: [SyncJobRecorder],
})
export class SyncJobsModule {}
