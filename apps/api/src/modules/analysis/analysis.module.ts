import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { ANALYSIS_ENQUEUER } from "./analysis-enqueuer";
import { AnalysisPauseService } from "./analysis-pause.service";
import { AnalysisPipelineService } from "./analysis-pipeline.service";
import { AnalysisWorkerService } from "./analysis-worker.service";
import { AnalysisRunsController } from "./analysis-runs.controller";
import { AnalysisRunsRepository } from "./analysis-runs.repository";
import { AnalysisRunsService } from "./analysis-runs.service";
import { AnalysisService } from "./analysis.service";
import { BulkReanalyzeThrottle } from "./bulk-reanalyze-throttle";
import { ANALYSIS_RUN_PROCESSOR } from "./run-processor";
import { AnalysisPolicyService } from "./settings/analysis-policy.service";
import { AnalysisSettingsController } from "./settings/analysis-settings.controller";
import { AnalysisSettingsRepository } from "./settings/analysis-settings.repository";
import { AnalysisSettingsService } from "./settings/analysis-settings.service";

/**
 * Analysis runs lifecycle + worker (T-070) + pipeline processor (T-074) + failure policy / pauses (T-075)
 * + per-project analysis settings (T-151, FR-190)
 * + mark-stale by version with shared bulk throttle (T-145). Provider tokens come from the global `ProvidersModule`.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AnalysisSettingsController, AnalysisRunsController],
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
    BulkReanalyzeThrottle,
    AnalysisRunsRepository,
    AnalysisRunsService,
  ],
  exports: [
    AnalysisPolicyService,
    AnalysisService,
    AnalysisPauseService,
    ANALYSIS_ENQUEUER,
    AnalysisPipelineService,
    AnalysisWorkerService,
    BulkReanalyzeThrottle,
  ],
})
export class AnalysisModule {}
