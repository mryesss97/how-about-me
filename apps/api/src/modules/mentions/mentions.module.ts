import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { AnalysisModule } from "../analysis/analysis.module";
import { AuditModule } from "../audit/audit.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { MentionsController } from "./mentions.controller";
import { MentionsRepository } from "./mentions.repository";
import { MentionsService } from "./mentions.service";

/** Mentions (social_posts) API — T-076 implements single re-analysis (FR-115). */
@Module({
  imports: [PrismaModule, AnalysisModule, AuditModule, ReviewsModule],
  controllers: [MentionsController],
  providers: [MentionsService, MentionsRepository],
})
export class MentionsModule {}
