import { Module } from "@nestjs/common";
import { COLLECTOR_RUNNER } from "./collector-runner";
import { QueryClaimRepository } from "./query-claim.repository";
import { SchedulerService } from "./scheduler.service";

/**
 * Collector scheduling (T-048). The tick only starts when APP_ROLE ∈ {worker, all} and a CollectorRunner is
 * bound to COLLECTOR_RUNNER (T-052 replaces the `null` placeholder).
 */
@Module({
  providers: [QueryClaimRepository, SchedulerService, { provide: COLLECTOR_RUNNER, useValue: null }],
  exports: [COLLECTOR_RUNNER, SchedulerService],
})
export class SchedulerModule {}
