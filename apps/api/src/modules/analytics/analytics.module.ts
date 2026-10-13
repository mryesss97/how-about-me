import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalyticsDistributionsController } from "./analytics-distributions.controller";
import { AnalyticsDistributionsRepository } from "./analytics-distributions.repository";
import { AnalyticsDistributionsService } from "./analytics-distributions.service";
import { OverviewController } from "./overview.controller";
import { OverviewRepository } from "./overview.repository";
import { OverviewService } from "./overview.service";

/** Analytics API (M4) — T-091 overview, T-093 distributions. Each ticket adds its own lines. */
@Module({
  imports: [PrismaModule],
  controllers: [OverviewController, AnalyticsDistributionsController],
  providers: [OverviewService, OverviewRepository, AnalyticsDistributionsService, AnalyticsDistributionsRepository],
})
export class AnalyticsModule {}
