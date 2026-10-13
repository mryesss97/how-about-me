import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ListeningQueriesController } from "./listening-queries.controller";
import { ListeningQueriesRepository } from "./listening-queries.repository";
import { ListeningQueriesService } from "./listening-queries.service";

@Module({
  imports: [AuditModule],
  controllers: [ListeningQueriesController],
  providers: [ListeningQueriesService, ListeningQueriesRepository],
  exports: [ListeningQueriesService],
})
export class ListeningQueriesModule {}
