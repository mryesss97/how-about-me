import { seedAuthUser, seedAuthUserFor } from "./seed-auth-user";

const KEY = "service-role-secret";
const base = {
  SUPABASE_URL: "https://x.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: KEY,
  SEED_ADMIN_EMAIL: " Admin@Example.com ",
};

function mockFetch(users: { email: string }[], ok = true) {
  return jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => ({ users }) }));
}

describe("seedAuthUser (T-008, US-006)", () => {
  it("skips (no throw) when service key or email is missing", async () => {
    const fetch = mockFetch([]);
    const log = jest.fn();
    expect(await seedAuthUser({ ...base, SUPABASE_SERVICE_ROLE_KEY: undefined }, { fetch, log })).toBe("skipped");
    expect(await seedAuthUser({ ...base, SEED_ADMIN_EMAIL: "" }, { fetch, log })).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns exists when the normalized email is already in Auth", async () => {
    const fetch = mockFetch([{ email: "admin@example.com" }]);
    expect(await seedAuthUser(base, { fetch, log: jest.fn() })).toBe("exists");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("creates a confirmed user with SEED_ADMIN_PASSWORD", async () => {
    const fetch = mockFetch([]);
    const log = jest.fn();
    expect(await seedAuthUser({ ...base, SEED_ADMIN_PASSWORD: "pw-secret" }, { fetch, log })).toBe("created");
    const [url, init] = fetch.mock.calls[1] as unknown as [string, { method: string; body: string }];
    expect(url).toBe("https://x.supabase.co/auth/v1/admin/users");
    expect(JSON.parse(init.body)).toEqual({ email: "admin@example.com", password: "pw-secret", email_confirm: true });
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain("pw-secret");
  });

  it("sends an invite when no password is set", async () => {
    const fetch = mockFetch([]);
    expect(await seedAuthUser(base, { fetch, log: jest.fn() })).toBe("invited");
    expect((fetch.mock.calls[1] as unknown as [string])[0]).toBe("https://x.supabase.co/auth/v1/invite");
  });

  it("throws without leaking the key when Supabase errors", async () => {
    const err = await seedAuthUser(base, { fetch: mockFetch([], false), log: jest.fn() }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).not.toContain(KEY);
  });
});

describe("seedAuthUserFor (#294 demo accounts)", () => {
  it("creates a non-admin seed account with its own password", async () => {
    const fetch = mockFetch([{ email: "admin@example.com" }]);
    const res = await seedAuthUserFor(
      { url: base.SUPABASE_URL, key: KEY, email: " Analyst@Example.com ", password: "pw-analyst" },
      { fetch, log: jest.fn() },
    );
    expect(res).toBe("created");
    const [, init] = fetch.mock.calls[1] as unknown as [string, { body: string }];
    const body: unknown = JSON.parse(init.body);
    expect(body).toMatchObject({ email: "analyst@example.com", password: "pw-analyst", email_confirm: true });
  });

  it("skips when no email is given", async () => {
    const fetch = mockFetch([]);
    expect(await seedAuthUserFor({ url: base.SUPABASE_URL, key: KEY }, { fetch, log: jest.fn() })).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });
});
