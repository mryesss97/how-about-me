import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { OverridesController } from "./overrides.controller";
import { OverridesRepository } from "./overrides.repository";
import { OverridesService } from "./overrides.service";
import { ReviewQueueController } from "./review-queue.controller";
import { ReviewQueueRepository } from "./review-queue.repository";
import { ReviewQueueService } from "./review-queue.service";

/** Analyst review: overrides (T-142) and review queue (T-144). Exports repositories so mention detail can read override history and review state (#339). */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OverridesController, ReviewQueueController],
  providers: [OverridesService, OverridesRepository, ReviewQueueService, ReviewQueueRepository],
  exports: [OverridesRepository, ReviewQueueRepository],
})
export class ReviewsModule {}
