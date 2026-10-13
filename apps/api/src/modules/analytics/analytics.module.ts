import { Module } from "@nestjs/common";
import { AnalyticsDistributionsController } from "./analytics-distributions.controller";
import { AnalyticsDistributionsRepository } from "./analytics-distributions.repository";
import { AnalyticsDistributionsService } from "./analytics-distributions.service";

/** Analytics routes (M4). Each ticket adds its own controller/service/repository lines. */
@Module({
  controllers: [AnalyticsDistributionsController],
  providers: [AnalyticsDistributionsService, AnalyticsDistributionsRepository],
})
export class AnalyticsModule {}
