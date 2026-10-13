import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalyticsTimeseriesController } from "./analytics-timeseries.controller";
import { AnalyticsTimeseriesRepository } from "./analytics-timeseries.repository";
import { AnalyticsTimeseriesService } from "./analytics-timeseries.service";

/** Analytics API (M4). Each widget ticket adds its own controller/service lines here. */
@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsTimeseriesController],
  providers: [AnalyticsTimeseriesService, AnalyticsTimeseriesRepository],
  exports: [AnalyticsTimeseriesService],
})
export class AnalyticsModule {}
