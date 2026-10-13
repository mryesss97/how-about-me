import { Module } from "@nestjs/common";
import { AuditModule } from "../modules/audit/audit.module";
import { RetentionJobService } from "./retention-job.service";

/** Scheduled retention job (T-153). PrismaModule is global; AuditService comes from AuditModule. */
@Module({ imports: [AuditModule], providers: [RetentionJobService], exports: [RetentionJobService] })
export class RetentionJobModule {}
