import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalysisModule } from "../analysis/analysis.module";
import { IngestionService } from "./ingestion.service";

/** Collector pipeline (T-051). `ANALYSIS_ENQUEUER` comes from `AnalysisModule` (T-070). */
@Module({
  imports: [PrismaModule, AnalysisModule],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class CollectorModule {}
