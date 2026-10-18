import type { PinoLogger } from "nestjs-pino";
import { IntegrationHealthService } from "./integration-health.service";
import type { IntegrationsRepository } from "./integrations.repository";

function setup(changed = 1) {
  const repo = { markAuthFailure: jest.fn().mockResolvedValue(changed) };
  const logger = { setContext: jest.fn(), warn: jest.fn() };
  const svc = new IntegrationHealthService(repo as unknown as IntegrationsRepository, logger as unknown as PinoLogger);
  return { svc, repo, logger };
}

describe("IntegrationHealthService (T-040, doc 06 §7)", () => {
  it("FR-045: THREADS_UNAUTHORIZED → expired", async () => {
    const { svc, repo } = setup();
    expect(await svc.recordProviderAuthFailure("p1", "THREADS_UNAUTHORIZED", "expired")).toBe(true);
    expect(repo.markAuthFailure).toHaveBeenCalledWith(
      "p1",
      "expired",
      "THREADS_UNAUTHORIZED",
      "expired",
      expect.any(Date),
    );
  });

  it("FR-085: THREADS_FORBIDDEN → permission_error", async () => {
    const { svc, repo } = setup();
    await svc.recordProviderAuthFailure("p1", "THREADS_FORBIDDEN", "scopes");
    expect(repo.markAuthFailure).toHaveBeenCalledWith(
      "p1",
      "permission_error",
      "THREADS_FORBIDDEN",
      "scopes",
      expect.any(Date),
    );
  });

  it.each(["THREADS_TIMEOUT", "THREADS_SERVER_ERROR", "INTERNAL", undefined])(
    "%s → status untouched (circuit breaker territory)",
    async (code) => {
      const { svc, repo } = setup();
      expect(await svc.recordProviderAuthFailure("p1", code, "x")).toBe(false);
      expect(repo.markAuthFailure).not.toHaveBeenCalled();
    },
  );

  it("connection no longer connected (race) → false, no warn", async () => {
    const { svc, logger } = setup(0);
    expect(await svc.recordProviderAuthFailure("p1", "THREADS_UNAUTHORIZED", "x")).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
