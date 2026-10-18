import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SyncJobsModule } from "../sync-jobs/sync-jobs.module";
import { ListeningQueriesController } from "./listening-queries.controller";
import { ListeningQueriesRepository } from "./listening-queries.repository";
import { ListeningQueriesService } from "./listening-queries.service";

@Module({
  imports: [AuditModule, SyncJobsModule],
  controllers: [ListeningQueriesController],
  providers: [ListeningQueriesService, ListeningQueriesRepository],
  exports: [ListeningQueriesService],
})
export class ListeningQueriesModule {}
