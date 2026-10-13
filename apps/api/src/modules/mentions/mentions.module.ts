import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalysisModule } from "../analysis/analysis.module";
import { AuditModule } from "../audit/audit.module";
import { ExportThrottle } from "../export/export-throttle";
import { ExportService } from "../export/export.service";
import { MentionsController } from "./mentions.controller";
import { MentionsRepository } from "./mentions.repository";
import { MentionsService } from "./mentions.service";

/** Mentions (social_posts) API — T-076 implements single re-analysis (FR-115). */
@Module({
  imports: [PrismaModule, AnalysisModule, AuditModule],
  controllers: [MentionsController],
  // T-147: export logic lives in modules/export; the route stays here so it is declared above `:mentionId`.
  providers: [MentionsService, MentionsRepository, ExportService, ExportThrottle],
})
export class MentionsModule {}
