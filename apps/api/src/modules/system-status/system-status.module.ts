import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { CollectorModule } from "../collector/collector.module";
import { SystemStatusController } from "./system-status.controller";
import { SystemStatusRepository } from "./system-status.repository";
import { SystemStatusService } from "./system-status.service";

/** System status endpoint v1 (T-057); analysis section stubbed until T-077. */
@Module({
  imports: [PrismaModule, CollectorModule],
  controllers: [SystemStatusController],
  providers: [SystemStatusRepository, SystemStatusService],
})
export class SystemStatusModule {}
