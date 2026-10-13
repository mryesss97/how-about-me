import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ANALYSIS_ENQUEUER } from "./analysis-enqueuer";
import { AnalysisWorkerService } from "./analysis-worker.service";
import { AnalysisService } from "./analysis.service";

/** Analysis runs lifecycle + worker (T-070). Provider tokens come from the global `ProvidersModule`. */
@Module({
  imports: [PrismaModule],
  providers: [AnalysisService, { provide: ANALYSIS_ENQUEUER, useExisting: AnalysisService }, AnalysisWorkerService],
  exports: [AnalysisService, ANALYSIS_ENQUEUER, AnalysisWorkerService],
})
export class AnalysisModule {}
