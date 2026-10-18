import type { Prisma } from "@prisma/client";
import { ProviderError } from "../../common/errors/provider.error";
import type { AuditService } from "../audit/audit.service";
import type { ConnectionRow } from "./integrations.mapper";
import type { IntegrationsRepository } from "./integrations.repository";
import { IntegrationsService, statusForVerifyError } from "./integrations.service";
import type { SocialDiscoveryProvider } from "./threads/social-discovery.provider";
import type { TokenStore } from "./threads/threads-token.store";

const PID = "p1";
const ACTOR = "u1";
const TOKEN = "THREADS-PLAINTEXT-TOKEN-0001";
const at = new Date("2026-10-01T00:00:00.000Z");
const row = (over: Partial<ConnectionRow> = {}): ConnectionRow => ({
  id: "c1",
  projectId: PID,
  platform: "threads",
  status: "disconnected",
  accountIdentifier: null,
  grantedScopes: [],
  tokenExpiresAt: null,
  lastVerifiedAt: null,
  lastSuccessAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  createdAt: at,
  updatedAt: at,
  ...over,
});

function setup(current: ConnectionRow | null, token: string | null = TOKEN) {
  const tx = {} as Prisma.TransactionClient;
  const repo = {
    findThreads: jest.fn().mockResolvedValue(current),
    upsertThreads: jest.fn((_p: string, patch: Partial<ConnectionRow>) =>
      Promise.resolve(row({ ...current, ...patch })),
    ),
    update: jest.fn((_id: string, patch: Partial<ConnectionRow>) => Promise.resolve(row({ ...current, ...patch }))),
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const tokens = {
    save: jest.fn().mockResolvedValue({ rotated: false }),
    read: jest.fn().mockResolvedValue(token),
    purge: jest.fn().mockResolvedValue(undefined),
  };
  const provider = {
    verifyConnection: jest.fn().mockResolvedValue({
      accountIdentifier: "fake_brand_account",
      grantedScopes: ["threads_basic"],
      tokenExpiresAt: at,
    }),
  };
  const svc = new IntegrationsService(
    repo as unknown as IntegrationsRepository,
    audit as unknown as AuditService,
    tokens as unknown as TokenStore,
    provider as unknown as SocialDiscoveryProvider,
  );
  return { svc, repo, audit, tokens, provider, tx };
}

describe("IntegrationsService (FR-040..FR-044)", () => {
  it("FR-040/BR-034/BR-036: PUT encrypts via the token store with the connection id, audit has no token", async () => {
    const { svc, tokens, audit, tx } = setup(null);
    const res = await svc.putThreadsToken(PID, { accessToken: TOKEN }, ACTOR, "req-1");
    expect(tokens.save).toHaveBeenCalledWith("c1", TOKEN, tx);
    expect(res.status).toBe("disconnected");
    expect(JSON.stringify(res)).not.toContain(TOKEN);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "integration.updated" }), tx);
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(TOKEN);
  });

  it("FR-041: verify success → connected with provider info", async () => {
    const { svc, repo, audit } = setup(row());
    const res = await svc.verifyThreads(PID, ACTOR, "req-1");
    expect(res.status).toBe("connected");
    expect(res.accountIdentifier).toBe("fake_brand_account");
    expect(res.lastVerifiedAt).not.toBeNull();
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ lastErrorCode: null });
    expect(audit.record.mock.calls[0]?.[0]).toMatchObject({ action: "integration.verified", metadata: { ok: true } });
  });

  it("FR-042/TC-INT-005: 401 → expired persisted, then rethrows", async () => {
    const { svc, repo, provider, audit } = setup(row({ status: "connected" }));
    provider.verifyConnection.mockRejectedValue(new ProviderError("THREADS_UNAUTHORIZED", "expired"));
    await expect(svc.verifyThreads(PID, ACTOR, null)).rejects.toMatchObject({ code: "THREADS_UNAUTHORIZED" });
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ status: "expired", lastErrorCode: "THREADS_UNAUTHORIZED" });
    expect(audit.record.mock.calls[0]?.[0]).toMatchObject({ metadata: { ok: false, code: "THREADS_UNAUTHORIZED" } });
  });

  it("FR-042: 403 → permission_error", async () => {
    const { svc, repo, provider } = setup(row());
    provider.verifyConnection.mockRejectedValue(new ProviderError("THREADS_FORBIDDEN"));
    await expect(svc.verifyThreads(PID, ACTOR, null)).rejects.toBeInstanceOf(ProviderError);
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ status: "permission_error" });
  });

  it("transient errors keep status; upstream → error", () => {
    expect(statusForVerifyError("THREADS_TIMEOUT", "connected")).toBe("connected");
    expect(statusForVerifyError("THREADS_RATE_LIMITED", "connected")).toBe("connected");
    expect(statusForVerifyError("THREADS_UPSTREAM_ERROR", "connected")).toBe("error");
  });

  it("verify without a stored token → 409 INTEGRATION_NOT_CONFIGURED", async () => {
    await expect(setup(null).svc.verifyThreads(PID, ACTOR, null)).rejects.toMatchObject({
      code: "INTEGRATION_NOT_CONFIGURED",
    });
    await expect(setup(row(), null).svc.verifyThreads(PID, ACTOR, null)).rejects.toMatchObject({
      code: "INTEGRATION_NOT_CONFIGURED",
    });
  });

  it("FR-043: disconnect purges the secret, marks disconnected and audits in one tx", async () => {
    const { svc, tokens, repo, audit, tx } = setup(row({ status: "connected" }));
    await svc.disconnectThreads(PID, ACTOR, null);
    expect(tokens.purge).toHaveBeenCalledWith("c1", tx);
    expect(repo.update.mock.calls[0]?.[1]).toMatchObject({ status: "disconnected" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "integration.disconnected" }), tx);
  });

  it("FR-043: disconnect is idempotent when nothing is configured", async () => {
    const { svc, audit } = setup(null);
    await expect(svc.disconnectThreads(PID, ACTOR, null)).resolves.toBeUndefined();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
