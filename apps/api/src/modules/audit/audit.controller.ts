import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditLogsQuerySchema } from "@how-about-me/contracts";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import type { AuditListPage, AuditListQuery } from "./audit.repository";
import { AuditService } from "./audit.service";

/** docs/02-architecture/05-api-contract.md §11 — FR-201, admin only (TC-SYS-015). Read-only: audit is immutable. */
@ApiTags("audit")
@ApiBearerAuth()
@Controller("projects/:projectId/audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles("admin")
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(AuditLogsQuerySchema)) query: AuditListQuery,
  ): Promise<AuditListPage> {
    return this.audit.list(projectId, query);
  }
}
