import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalyticsDistributionsController } from "./analytics-distributions.controller";
import { AnalyticsDistributionsRepository } from "./analytics-distributions.repository";
import { AnalyticsDistributionsService } from "./analytics-distributions.service";
import { AnalyticsTimeseriesController } from "./analytics-timeseries.controller";
import { AnalyticsTimeseriesRepository } from "./analytics-timeseries.repository";
import { AnalyticsTimeseriesService } from "./analytics-timeseries.service";
import { OverviewController } from "./overview.controller";
import { OverviewRepository } from "./overview.repository";
import { OverviewService } from "./overview.service";

/** Analytics API (M4) — T-091 overview, T-092 timeseries, T-093 distributions. Each widget ticket adds its own lines here. */
@Module({
  imports: [PrismaModule],
  controllers: [OverviewController, AnalyticsTimeseriesController, AnalyticsDistributionsController],
  providers: [
    OverviewService,
    OverviewRepository,
    AnalyticsTimeseriesService,
    AnalyticsTimeseriesRepository,
    AnalyticsDistributionsService,
    AnalyticsDistributionsRepository,
  ],
  exports: [AnalyticsTimeseriesService],
})
export class AnalyticsModule {}
