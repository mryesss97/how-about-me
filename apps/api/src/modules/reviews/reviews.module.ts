import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { OverridesController } from "./overrides.controller";
import { OverridesRepository } from "./overrides.repository";
import { OverridesService } from "./overrides.service";

/** Analyst review: overrides (T-142). Exports the repository so mention detail can read override history. */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OverridesController],
  providers: [OverridesService, OverridesRepository],
  exports: [OverridesRepository],
})
export class ReviewsModule {}
