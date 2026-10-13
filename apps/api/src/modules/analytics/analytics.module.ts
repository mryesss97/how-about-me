import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { OverviewController } from "./overview.controller";
import { OverviewRepository } from "./overview.repository";
import { OverviewService } from "./overview.service";

/** Analytics API (M4) — T-091 overview. */
@Module({
  imports: [PrismaModule],
  controllers: [OverviewController],
  providers: [OverviewService, OverviewRepository],
})
export class AnalyticsModule {}
