import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { SystemStatusResponse } from "@how-about-me/contracts";
import { SystemStatusService } from "./system-status.service";

/** docs/02-architecture/05-api-contract.md §10 — FR-171; read-only, any project member (guard enforces membership, FR-015). */
@ApiTags("system-status")
@ApiBearerAuth()
@Controller("projects/:projectId/system-status")
export class SystemStatusController {
  constructor(private readonly service: SystemStatusService) {}

  @Get()
  get(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<SystemStatusResponse> {
    return this.service.get(projectId);
  }
}
