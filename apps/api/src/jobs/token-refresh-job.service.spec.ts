import type { SchedulerRegistry } from "@nestjs/schedule";
import type { PinoLogger } from "nestjs-pino";
import { ProviderError } from "../common/errors/provider.error";
import type { AppConfig } from "../config/config.module";
import type { AuditService } from "../modules/audit/audit.service";
import type { IntegrationHealthService } from "../modules/integrations/integration-health.service";
import type { IntegrationsRepository } from "../modules/integrations/integrations.repository";
import type { SocialDiscoveryProvider } from "../modules/integrations/threads/social-discovery.provider";
import type { ThreadsTokenStore } from "../modules/integrations/threads/threads-token.store";
import { TOKEN_REFRESH_CRON_JOB, TokenRefreshJobService } from "./token-refresh-job.service";

const NOW = new Date("2026-10-18T00:00:00Z");
const NEW_EXPIRY = new Date("2026-12-17T00:00:00Z");

function setup(opts: { mode?: "on" | "off"; refresh?: boolean; nodeEnv?: string } = {}) {
  const cfg = {
    THREADS_TOKEN_REFRESH_MODE: opts.mode ?? "on",
    THREADS_TOKEN_REFRESH_CRON: "0 3 * * *",
    THREADS_TOKEN_REFRESH_TIMEZONE: "Asia/Ho_Chi_Minh",
    THREADS_TOKEN_REFRESH_WINDOW_DAYS: 7,
    APP_ROLE: "worker",
    NODE_ENV: opts.nodeEnv ?? "development",
  } as unknown as AppConfig;
  const refreshToken = jest.fn().mockResolvedValue({ accessToken: "new-secret", tokenExpiresAt: NEW_EXPIRY });
  const provider = {
    platform: "threads",
    search: jest.fn(),
    verifyConnection: jest.fn(),
    ...(opts.refresh === false ? {} : { refreshToken }),
  } as unknown as SocialDiscoveryProvider;
  const repo = {
    findExpiringThreads: jest.fn().mockResolvedValue([
      { id: "c1", projectId: "p1", tokenExpiresAt: new Date("2026-10-21T00:00:00Z") },
      { id: "c2", projectId: "p2", tokenExpiresAt: new Date("2026-10-20T00:00:00Z") },
    ]),
    transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    update: jest.fn().mockResolvedValue({}),
  };
  const tokens = {
    read: jest.fn().mockResolvedValue("old-secret"),
    save: jest.fn().mockResolvedValue({ rotated: true }),
  };
  const health = { recordProviderAuthFailure: jest.fn().mockResolvedValue(true) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const registry = { addCronJob: jest.fn(), doesExist: jest.fn().mockReturnValue(false) };
  const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const svc = new TokenRefreshJobService(
    cfg,
    provider,
    repo as unknown as IntegrationsRepository,
    tokens as unknown as ThreadsTokenStore,
    health as unknown as IntegrationHealthService,
    audit as unknown as AuditService,
    registry as unknown as SchedulerRegistry,
    logger as unknown as PinoLogger,
  );
  return { svc, refreshToken, repo, tokens, health, audit, registry, logger };
}

describe("TokenRefreshJobService (T-040, FR-046)", () => {
  it("MODE=off → no cron registered", () => {
    const { svc, registry } = setup({ mode: "off" });
    svc.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
  });

  it("provider without refreshToken → FR-046 N/A warning, no cron", () => {
    const { svc, registry, logger } = setup({ refresh: false });
    svc.onModuleInit();
    expect(registry.addCronJob).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("N/A"));
  });

  it("MODE=on + worker + provider support → cron registered", async () => {
    const { svc, registry } = setup();
    svc.onModuleInit();
    expect(registry.addCronJob).toHaveBeenCalledWith(TOKEN_REFRESH_CRON_JOB, expect.anything());
    const job = registry.addCronJob.mock.calls[0]?.[1] as { stop: () => void };
    job.stop();
  });

  it("FR-046 / TC-INT-011: selects connections expiring within 7 days", async () => {
    const { svc, repo } = setup();
    await svc.run(NOW);
    expect(repo.findExpiringThreads).toHaveBeenCalledWith(new Date("2026-10-25T00:00:00Z"));
  });

  it("FR-046: success → token rotated and expiry updated in one transaction", async () => {
    const { svc, tokens, repo, audit } = setup();
    expect(await svc.run(NOW)).toEqual({ candidates: 2, refreshed: 2, failed: 0 });
    expect(tokens.save).toHaveBeenCalledWith("c1", "new-secret", {});
    expect(repo.update).toHaveBeenCalledWith("c1", { tokenExpiresAt: NEW_EXPIRY }, {});
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("FR-046: failure → integration.refresh_failed audit without token, 401 moves status, next row continues", async () => {
    const { svc, refreshToken, audit, health, tokens } = setup();
    refreshToken.mockRejectedValueOnce(new ProviderError("THREADS_UNAUTHORIZED", "expired", { providerStatus: 401 }));
    expect(await svc.run(NOW)).toEqual({ candidates: 2, refreshed: 1, failed: 1 });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        actorUserId: null,
        action: "integration.refresh_failed",
        entityId: "c1",
        metadata: { errorCode: "THREADS_UNAUTHORIZED", status: "failed" },
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain("secret");
    expect(health.recordProviderAuthFailure).toHaveBeenCalledWith("p1", "THREADS_UNAUTHORIZED", "expired");
    expect(tokens.save).toHaveBeenCalledTimes(1);
  });
});
