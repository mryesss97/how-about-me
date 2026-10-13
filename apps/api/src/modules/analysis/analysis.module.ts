import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { ANALYSIS_ENQUEUER } from "./analysis-enqueuer";
import { AnalysisPauseService } from "./analysis-pause.service";
import { AnalysisPipelineService } from "./analysis-pipeline.service";
import { AnalysisWorkerService } from "./analysis-worker.service";
import { AnalysisService } from "./analysis.service";
import { ANALYSIS_RUN_PROCESSOR } from "./run-processor";

/** Analysis runs lifecycle + worker (T-070) + pipeline processor (T-074) + failure policy / pauses (T-075). Provider tokens come from the global `ProvidersModule`. */
@Module({
  imports: [PrismaModule],
  providers: [
    AnalysisService,
    { provide: ANALYSIS_ENQUEUER, useExisting: AnalysisService },
    AnalysisPipelineService,
    { provide: ANALYSIS_RUN_PROCESSOR, useExisting: AnalysisPipelineService },
    AnalysisPauseService,
    AnalysisWorkerService,
  ],
  exports: [AnalysisService, AnalysisPauseService, ANALYSIS_ENQUEUER, AnalysisPipelineService, AnalysisWorkerService],
})
export class AnalysisModule {}
