import { Inject, Injectable } from "@nestjs/common";
import type { IntegrationStatus, PutThreadsIntegrationBody, ThreadsIntegrationStatus } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import { ProviderError } from "../../common/errors/provider.error";
import { AuditService } from "../audit/audit.service";
import { type ConnectionPatch, IntegrationsRepository } from "./integrations.repository";
import { toThreadsStatus } from "./integrations.mapper";
import { SOCIAL_DISCOVERY_PROVIDER, type SocialDiscoveryProvider } from "./threads/social-discovery.provider";
import { THREADS_TOKEN_STORE, type TokenStore } from "./threads/threads-token.store";

/**
 * Verify failure → connection status (docs/02-architecture/05-api-contract.md §4).
 * Transient failures (timeout, rate limit) keep the current status and only record `lastError`.
 */
export function statusForVerifyError(code: string, current: IntegrationStatus): IntegrationStatus {
  switch (code) {
    case "THREADS_UNAUTHORIZED":
      return "expired";
    case "THREADS_FORBIDDEN":
      return "permission_error";
    case "THREADS_TIMEOUT":
    case "THREADS_RATE_LIMITED":
      return current;
    default:
      return "error";
  }
}

/** Threads integration — FR-040..FR-044; audit without secrets (BR-034); token never leaves the server (BR-036). */
@Injectable()
export class IntegrationsService {
  constructor(
    private readonly repo: IntegrationsRepository,
    private readonly audit: AuditService,
    @Inject(THREADS_TOKEN_STORE) private readonly tokens: TokenStore,
    @Inject(SOCIAL_DISCOVERY_PROVIDER) private readonly provider: SocialDiscoveryProvider,
  ) {}

  /** FR-044: status for any member; never the token. */
  async getThreads(projectId: string): Promise<ThreadsIntegrationStatus> {
    return toThreadsStatus(await this.repo.findThreads(projectId));
  }

  /**
   * FR-040: store (or rotate) the token encrypted. The connection stays `disconnected` until a
   * successful verify, so the scheduler never runs on an unchecked token.
   */
  async putThreadsToken(
    projectId: string,
    body: PutThreadsIntegrationBody,
    actorId: string,
    requestId: string | null,
  ): Promise<ThreadsIntegrationStatus> {
    const row = await this.repo.transaction(async (tx) => {
      const conn = await this.repo.upsertThreads(
        projectId,
        {
          status: "disconnected",
          accountIdentifier: body.accountIdentifier ?? null,
          tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : null,
          grantedScopes: [],
          lastVerifiedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
        tx,
      );
      const { rotated } = await this.tokens.save(conn.id, body.accessToken, tx);
      // BR-034: metadata carries no token.
      await this.audit.record(
        {
          projectId,
          actorUserId: actorId,
          action: "integration.updated",
          entityType: "integration_connection",
          entityId: conn.id,
          metadata: {
            platform: "threads",
            accountIdentifier: conn.accountIdentifier,
            tokenExpiresAt: conn.tokenExpiresAt?.toISOString() ?? null,
            rotated,
          },
          requestId,
        },
        tx,
      );
      return conn;
    });
    return toThreadsStatus(row);
  }

  /**
   * FR-041/FR-042: live check against the provider. On failure the new status is committed first and
   * the provider error is rethrown (TC-INT-005) — no shared transaction with the throw.
   */
  async verifyThreads(projectId: string, actorId: string, requestId: string | null): Promise<ThreadsIntegrationStatus> {
    const conn = await this.repo.findThreads(projectId);
    const notConfigured = () => new AppError("INTEGRATION_NOT_CONFIGURED", "Threads token is not configured");
    if (!conn) throw notConfigured();

    let token: string | null;
    try {
      token = await this.tokens.read(projectId);
    } catch (err: unknown) {
      // Decrypt failure: generic INTERNAL, details stay out of the response (BR-036).
      const msg = "Stored token could not be read";
      await this.recordFailure(conn.id, projectId, "error", "INTERNAL", msg, actorId, requestId);
      throw err;
    }
    if (!token) throw notConfigured();

    try {
      const info = await this.provider.verifyConnection({ accessToken: token, requestId: requestId ?? "", projectId });
      const patch: ConnectionPatch = {
        status: "connected",
        lastVerifiedAt: new Date(),
        accountIdentifier: info.accountIdentifier ?? conn.accountIdentifier,
        grantedScopes: info.grantedScopes,
        tokenExpiresAt: info.tokenExpiresAt ?? conn.tokenExpiresAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      };
      const updated = await this.repo.update(conn.id, patch);
      await this.audit.record({
        projectId,
        actorUserId: actorId,
        action: "integration.verified",
        entityType: "integration_connection",
        entityId: conn.id,
        metadata: { platform: "threads", ok: true, accountIdentifier: updated.accountIdentifier },
        requestId,
      });
      return toThreadsStatus(updated);
    } catch (err: unknown) {
      if (!(err instanceof ProviderError)) throw err;
      const status = statusForVerifyError(err.code, conn.status);
      await this.recordFailure(conn.id, projectId, status, err.code, err.message, actorId, requestId);
      throw err;
    }
  }

  /** FR-043: delete the secret and mark disconnected; idempotent (204 even when nothing is configured). */
  async disconnectThreads(projectId: string, actorId: string, requestId: string | null): Promise<void> {
    await this.repo.transaction(async (tx) => {
      const conn = await this.repo.findThreads(projectId, tx);
      if (!conn) return;
      await this.tokens.purge(conn.id, tx);
      await this.repo.update(
        conn.id,
        {
          status: "disconnected",
          accountIdentifier: null,
          grantedScopes: [],
          tokenExpiresAt: null,
          lastVerifiedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
        tx,
      );
      await this.audit.record(
        {
          projectId,
          actorUserId: actorId,
          action: "integration.disconnected",
          entityType: "integration_connection",
          entityId: conn.id,
          metadata: { platform: "threads" },
          requestId,
        },
        tx,
      );
    });
  }

  private async recordFailure(
    connectionId: string,
    projectId: string,
    status: IntegrationStatus,
    code: string,
    message: string,
    actorId: string,
    requestId: string | null,
  ): Promise<void> {
    await this.repo.update(connectionId, {
      status,
      lastErrorCode: code,
      lastErrorMessage: message,
      lastErrorAt: new Date(),
    });
    await this.audit.record({
      projectId,
      actorUserId: actorId,
      action: "integration.verified",
      entityType: "integration_connection",
      entityId: connectionId,
      metadata: { platform: "threads", ok: false, code },
      requestId,
    });
  }
}
