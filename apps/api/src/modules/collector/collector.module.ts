import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalysisModule } from "../analysis/analysis.module";
import { SyncJobsModule } from "../sync-jobs/sync-jobs.module";
import { CollectorService } from "./collector.service";
import { IngestionService } from "./ingestion.service";

/** Collector pipeline (T-051 ingestion, T-052 run loop). `ANALYSIS_ENQUEUER` comes from `AnalysisModule` (T-070). */
@Module({
  imports: [PrismaModule, AnalysisModule, SyncJobsModule],
  providers: [IngestionService, CollectorService],
  exports: [IngestionService, CollectorService],
})
export class CollectorModule {}
