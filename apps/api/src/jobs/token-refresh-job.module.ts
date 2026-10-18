import { Module } from "@nestjs/common";
import { AuditModule } from "../modules/audit/audit.module";
import { IntegrationsModule } from "../modules/integrations/integrations.module";
import { TokenRefreshJobService } from "./token-refresh-job.service";

/** Threads token refresh job (T-040, FR-046). Provider token comes from the global ProvidersModule. */
@Module({
  imports: [AuditModule, IntegrationsModule],
  providers: [TokenRefreshJobService],
  exports: [TokenRefreshJobService],
})
export class TokenRefreshJobModule {}
