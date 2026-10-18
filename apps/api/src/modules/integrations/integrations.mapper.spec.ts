import type { ConnectionRow } from "./integrations.mapper";
import { toThreadsStatus } from "./integrations.mapper";

const at = new Date("2026-10-01T00:00:00.000Z");
const row = (over: Partial<ConnectionRow> = {}): ConnectionRow => ({
  id: "c1",
  projectId: "p1",
  platform: "threads",
  status: "connected",
  accountIdentifier: "acc",
  grantedScopes: ["threads_basic"],
  tokenExpiresAt: at,
  lastVerifiedAt: at,
  lastSuccessAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorAt: null,
  createdAt: at,
  updatedAt: at,
  ...over,
});

describe("toThreadsStatus (FR-044)", () => {
  it("no row → default disconnected", () => {
    expect(toThreadsStatus(null)).toEqual({
      status: "disconnected",
      accountIdentifier: null,
      grantedScopes: [],
      tokenExpiresAt: null,
      lastVerifiedAt: null,
      lastSuccessAt: null,
      lastError: null,
    });
  });

  it("maps dates to ISO UTC and lastError null without a code", () => {
    const dto = toThreadsStatus(row());
    expect(dto.tokenExpiresAt).toBe("2026-10-01T00:00:00.000Z");
    expect(dto.lastError).toBeNull();
  });

  it("maps lastError when a code is stored (BR-036: no secret fields in the DTO)", () => {
    const dto = toThreadsStatus(row({ lastErrorCode: "THREADS_UNAUTHORIZED", lastErrorMessage: "x", lastErrorAt: at }));
    expect(dto.lastError).toEqual({ code: "THREADS_UNAUTHORIZED", message: "x", at: at.toISOString() });
    expect(Object.keys(dto)).not.toEqual(expect.arrayContaining(["accessToken"]));
  });
});
