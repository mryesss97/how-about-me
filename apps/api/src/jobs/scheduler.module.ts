import { Module } from "@nestjs/common";
import { CollectorModule } from "../modules/collector/collector.module";
import { CollectorService } from "../modules/collector/collector.service";
import { COLLECTOR_RUNNER } from "./collector-runner";
import { QueryClaimRepository } from "./query-claim.repository";
import { SchedulerService } from "./scheduler.service";

/**
 * Collector scheduling (T-048). The tick only starts when APP_ROLE ∈ {worker, all}; COLLECTOR_RUNNER is
 * `CollectorService` (T-052).
 */
@Module({
  imports: [CollectorModule],
  providers: [QueryClaimRepository, SchedulerService, { provide: COLLECTOR_RUNNER, useExisting: CollectorService }],
  exports: [COLLECTOR_RUNNER, SchedulerService],
})
export class SchedulerModule {}
