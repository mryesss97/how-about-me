import type { PrismaService } from "../../database/prisma.service";
import { LAST_LOGIN_THROTTLE_MS, UserProfilesService } from "./user-profiles.service";

const token = { sub: "sub-1", email: "Alice@Example.com", name: "Alice", payload: {} };

function setup() {
  const userProfile = { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() };
  const svc = new UserProfilesService({ userProfile } as unknown as PrismaService);
  return { svc, userProfile };
}

const row = (o: Partial<{ id: string; email: string; displayName: string | null; lastLoginAt: Date | null }> = {}) => ({
  id: "sub-1",
  email: "alice@example.com",
  displayName: "Alice",
  lastLoginAt: new Date(),
  ...o,
});

describe("UserProfilesService.ensureProfile (FR-017, FR-033)", () => {
  it("TC-AUTH-013: new user → create with lowercase email + displayName + lastLoginAt", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValue(null);
    userProfile.create.mockImplementation(({ data }: { data: object }) => Promise.resolve(data));
    const u = await svc.ensureProfile(token);
    expect(u).toEqual({ id: "sub-1", email: "alice@example.com", displayName: "Alice" });
    expect(userProfile.create.mock.calls[0][0].data.lastLoginAt).toBeInstanceOf(Date);
  });

  it("no email claim → placeholder email `${sub}@unknown.local`", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValue(null);
    userProfile.create.mockImplementation(({ data }: { data: object }) => Promise.resolve(data));
    expect((await svc.ensureProfile({ ...token, email: "" })).email).toBe("sub-1@unknown.local");
  });

  it("recent login (< 5 min) and nothing changed → no write", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValue(row());
    await svc.ensureProfile(token);
    expect(userProfile.update).not.toHaveBeenCalled();
  });

  it("stale lastLoginAt (≥ 5 min) → updates lastLoginAt", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValue(row({ lastLoginAt: new Date(Date.now() - LAST_LOGIN_THROTTLE_MS - 1) }));
    userProfile.update.mockResolvedValue(row());
    await svc.ensureProfile(token);
    expect(Object.keys(userProfile.update.mock.calls[0][0].data)).toEqual(["lastLoginAt"]);
  });

  it("changed email / missing displayName are written even within throttle window", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValue(row({ email: "old@example.com", displayName: null }));
    userProfile.update.mockResolvedValue(row());
    await svc.ensureProfile(token);
    expect(userProfile.update.mock.calls[0][0].data).toEqual({ email: "alice@example.com", displayName: "Alice" });
  });

  it("FR-033: invitation placeholder found by email → re-keyed to sub", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row({ id: "placeholder", displayName: null }));
    userProfile.update.mockResolvedValue(row());
    await svc.ensureProfile(token);
    expect(userProfile.update.mock.calls[0][0]).toMatchObject({
      where: { id: "placeholder" },
      data: { id: "sub-1", displayName: "Alice" },
    });
  });

  it.each(["P2002", "P2025"])("concurrent first login (%s) → re-reads by id", async (code) => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(row());
    userProfile.create.mockRejectedValue(Object.assign(new Error("dup"), { code }));
    expect(await svc.ensureProfile(token)).toEqual({ id: "sub-1", email: "alice@example.com", displayName: "Alice" });
  });

  it("other errors propagate", async () => {
    const { svc, userProfile } = setup();
    userProfile.findUnique.mockResolvedValue(null);
    userProfile.create.mockRejectedValue(new Error("boom"));
    await expect(svc.ensureProfile(token)).rejects.toThrow("boom");
  });
});
