import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ANALYSIS_ENQUEUER, SqlAnalysisEnqueuer } from "../analysis/analysis-enqueuer";
import { IngestionService } from "./ingestion.service";

/** Collector pipeline (T-051). Provider tokens come from the global `ProvidersModule`. */
@Module({
  imports: [PrismaModule],
  providers: [IngestionService, { provide: ANALYSIS_ENQUEUER, useClass: SqlAnalysisEnqueuer }],
  exports: [IngestionService],
})
export class CollectorModule {}
