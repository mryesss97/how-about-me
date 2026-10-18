import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsRepository } from "./integrations.repository";
import { IntegrationHealthService } from "./integration-health.service";
import { IntegrationsService } from "./integrations.service";
import { THREADS_TOKEN_STORE, ThreadsTokenStore } from "./threads/threads-token.store";

/** T-038 — CryptoModule and the provider token are global. Exports the token store for the collector (T-052);
 * IntegrationHealthService / repository for collector status transitions and the refresh job (T-040). */
@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationsRepository,
    IntegrationHealthService,
    ThreadsTokenStore,
    { provide: THREADS_TOKEN_STORE, useExisting: ThreadsTokenStore },
  ],
  exports: [THREADS_TOKEN_STORE, ThreadsTokenStore, IntegrationHealthService, IntegrationsRepository],
})
export class IntegrationsModule {}
