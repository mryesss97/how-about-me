import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MembersModule } from "./members/members.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [AuditModule, MembersModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
