import { Injectable } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { IntegrationsRepository } from "./integrations.repository";

const AUTH_STATUS = {
  THREADS_UNAUTHORIZED: "expired",
  THREADS_FORBIDDEN: "permission_error",
} as const;

export const isProviderAuthError = (code: string | undefined): code is keyof typeof AUTH_STATUS =>
  code === "THREADS_UNAUTHORIZED" || code === "THREADS_FORBIDDEN";

/**
 * Integration status transitions caused by the system (not an admin) — FR-045, FR-085,
 * docs/02-architecture/06-ingestion-pipeline.md §7. 401 → `expired`, 403 → `permission_error`; other
 * errors (5xx, timeout) are the circuit breaker's job and never change the status.
 * Once the status leaves `connected` the scheduler claim skips the project until a successful verify.
 */
@Injectable()
export class IntegrationHealthService {
  constructor(
    private readonly repo: IntegrationsRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(IntegrationHealthService.name);
  }

  /** Returns true when the connection status changed (false: other code, or no longer `connected`). */
  async recordProviderAuthFailure(projectId: string, code: string | undefined, message: string): Promise<boolean> {
    if (!isProviderAuthError(code)) return false;
    const status = AUTH_STATUS[code];
    const changed = await this.repo.markAuthFailure(projectId, status, code, message, new Date());
    if (changed > 0)
      this.logger.warn({ projectId, errorCode: code, status }, "integration status changed by provider error");
    return changed > 0;
  }
}
