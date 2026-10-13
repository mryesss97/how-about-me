import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { ANALYSIS_ENQUEUER } from "./analysis-enqueuer";
import { AnalysisPauseService } from "./analysis-pause.service";
import { AnalysisPipelineService } from "./analysis-pipeline.service";
import { AnalysisWorkerService } from "./analysis-worker.service";
import { AnalysisService } from "./analysis.service";
import { ANALYSIS_RUN_PROCESSOR } from "./run-processor";
import { AnalysisPolicyService } from "./settings/analysis-policy.service";
import { AnalysisSettingsController } from "./settings/analysis-settings.controller";
import { AnalysisSettingsRepository } from "./settings/analysis-settings.repository";
import { AnalysisSettingsService } from "./settings/analysis-settings.service";

/**
 * Analysis runs lifecycle + worker (T-070) + pipeline processor (T-074) + failure policy / pauses (T-075)
 * + per-project analysis settings (T-151, FR-190). Provider tokens come from the global `ProvidersModule`.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AnalysisSettingsController],
  providers: [
    AnalysisSettingsRepository,
    AnalysisPolicyService,
    AnalysisSettingsService,
    AnalysisService,
    { provide: ANALYSIS_ENQUEUER, useExisting: AnalysisService },
    AnalysisPipelineService,
    { provide: ANALYSIS_RUN_PROCESSOR, useExisting: AnalysisPipelineService },
    AnalysisPauseService,
    AnalysisWorkerService,
  ],
  exports: [
    AnalysisPolicyService,
    AnalysisService,
    AnalysisPauseService,
    ANALYSIS_ENQUEUER,
    AnalysisPipelineService,
    AnalysisWorkerService,
  ],
})
export class AnalysisModule {}
