import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalyticsTimeseriesController } from "./analytics-timeseries.controller";
import { AnalyticsTimeseriesRepository } from "./analytics-timeseries.repository";
import { AnalyticsTimeseriesService } from "./analytics-timeseries.service";
import { OverviewController } from "./overview.controller";
import { OverviewRepository } from "./overview.repository";
import { OverviewService } from "./overview.service";

/** Analytics API (M4) — T-091 overview, T-092 timeseries. Each widget ticket adds its own lines here. */
@Module({
  imports: [PrismaModule],
  controllers: [OverviewController, AnalyticsTimeseriesController],
  providers: [OverviewService, OverviewRepository, AnalyticsTimeseriesService, AnalyticsTimeseriesRepository],
  exports: [AnalyticsTimeseriesService],
})
export class AnalyticsModule {}
