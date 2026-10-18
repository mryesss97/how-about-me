import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsRepository } from "./integrations.repository";
import { IntegrationsService } from "./integrations.service";
import { THREADS_TOKEN_STORE, ThreadsTokenStore } from "./threads/threads-token.store";

/** T-038 — CryptoModule and the provider token are global. Exports the token store for the collector (T-052). */
@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationsRepository,
    ThreadsTokenStore,
    { provide: THREADS_TOKEN_STORE, useExisting: ThreadsTokenStore },
  ],
  exports: [THREADS_TOKEN_STORE, ThreadsTokenStore],
})
export class IntegrationsModule {}
