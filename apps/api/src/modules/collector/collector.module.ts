import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalysisModule } from "../analysis/analysis.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { SyncJobsModule } from "../sync-jobs/sync-jobs.module";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { CollectorStateRepository } from "./collector-state.repository";
import { CollectorService } from "./collector.service";
import { IngestionService } from "./ingestion.service";

/** Collector pipeline (T-051 ingestion, T-052 run loop, T-054 circuit breaker). `ANALYSIS_ENQUEUER` comes from `AnalysisModule` (T-070). */
@Module({
  imports: [PrismaModule, AnalysisModule, SyncJobsModule, IntegrationsModule],
  providers: [IngestionService, CollectorService, CollectorStateRepository, CircuitBreakerService],
  exports: [IngestionService, CollectorService, CircuitBreakerService],
})
export class CollectorModule {}
