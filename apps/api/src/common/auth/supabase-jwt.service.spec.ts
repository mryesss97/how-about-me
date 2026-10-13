import { Logger } from "@nestjs/common";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import type { AppConfig } from "../../config/config.module";
import { AppError } from "../errors/app.error";
import { SupabaseJwtService } from "./supabase-jwt.service";

// Remote JWKS is replaced by a local key set so no network is touched.
let localJwks: JWK[] = [];
jest.mock("jose", () => {
  const actual = jest.requireActual<typeof import("jose")>("jose");
  return {
    ...actual,
    createRemoteJWKSet: () => (header: Parameters<ReturnType<typeof actual.createLocalJWKSet>>[0]) =>
      actual.createLocalJWKSet({ keys: localJwks })(header),
  };
});

const SECRET = "unit-secret-unit-secret-unit-secret";
const SUPABASE_URL = "https://ref.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const enc = (s: string) => new TextEncoder().encode(s);

function cfg(over: Partial<AppConfig>): AppConfig {
  return { NODE_ENV: "test", ...over } as AppConfig;
}

function build(
  claims: Record<string, unknown> = {},
  o: {
    sub?: string | null;
    aud?: string;
    iss?: string;
    exp?: string | number;
    header?: { alg: string; kid?: string };
  } = {},
) {
  const jwt = new SignJWT({ email: "A@Example.com", user_metadata: { full_name: "Alice" }, ...claims })
    .setProtectedHeader(o.header ?? { alg: "HS256" })
    .setAudience(o.aud ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(o.exp ?? "1h");
  if (o.sub !== null) jwt.setSubject(o.sub ?? "user-1");
  if (o.iss) jwt.setIssuer(o.iss);
  return jwt;
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "OK";
  } catch (e) {
    return e instanceof AppError ? e.code : "UNKNOWN";
  }
}

describe("SupabaseJwtService — HS256 (FR-013)", () => {
  const svc = new SupabaseJwtService(cfg({ AUTH_TEST_JWT_SECRET: SECRET }));

  it("verifies a valid token and extracts sub/email/name", async () => {
    const r = await svc.verify(await build().sign(enc(SECRET)));
    expect(r).toMatchObject({ sub: "user-1", email: "A@Example.com", name: "Alice" });
  });

  it("TC-AUTH-006: wrong signature → AUTH_INVALID_TOKEN", async () => {
    expect(await codeOf(svc.verify(await build().sign(enc("other-secret-other-secret-xx"))))).toBe(
      "AUTH_INVALID_TOKEN",
    );
  });

  it("TC-AUTH-007: expired → AUTH_TOKEN_EXPIRED", async () => {
    const t = await build({}, { exp: Math.floor(Date.now() / 1000) - 60 }).sign(enc(SECRET));
    expect(await codeOf(svc.verify(t))).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("wrong audience → AUTH_INVALID_TOKEN", async () => {
    expect(await codeOf(svc.verify(await build({}, { aud: "anon" }).sign(enc(SECRET))))).toBe("AUTH_INVALID_TOKEN");
  });

  it("missing sub → AUTH_INVALID_TOKEN", async () => {
    expect(await codeOf(svc.verify(await build({}, { sub: null }).sign(enc(SECRET))))).toBe("AUTH_INVALID_TOKEN");
  });

  it("anonymous Supabase user → AUTH_INVALID_TOKEN", async () => {
    expect(await codeOf(svc.verify(await build({ is_anonymous: true }).sign(enc(SECRET))))).toBe("AUTH_INVALID_TOKEN");
  });

  it("garbage token → AUTH_INVALID_TOKEN", async () => {
    expect(await codeOf(svc.verify("abc"))).toBe("AUTH_INVALID_TOKEN");
  });

  it("no iss check when neither SUPABASE_JWT_ISSUER nor SUPABASE_URL is set", async () => {
    expect(await codeOf(svc.verify(await build({}, { iss: "anything" }).sign(enc(SECRET))))).toBe("OK");
  });

  it("no verification method configured → INTERNAL", async () => {
    expect(await codeOf(new SupabaseJwtService(cfg({})).verify("abc"))).toBe("INTERNAL");
  });

  it("ignores AUTH_TEST_JWT_SECRET outside NODE_ENV=test", async () => {
    const prod = new SupabaseJwtService(cfg({ NODE_ENV: "production", AUTH_TEST_JWT_SECRET: SECRET }));
    expect(await codeOf(prod.verify(await build().sign(enc(SECRET))))).toBe("INTERNAL");
  });
});

describe("SupabaseJwtService — issuer", () => {
  it("override SUPABASE_JWT_ISSUER: matching iss ok, other iss → AUTH_INVALID_TOKEN", async () => {
    const svc = new SupabaseJwtService(cfg({ SUPABASE_JWT_SECRET: SECRET, SUPABASE_JWT_ISSUER: "supabase" }));
    expect(await codeOf(svc.verify(await build({}, { iss: "supabase" }).sign(enc(SECRET))))).toBe("OK");
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    expect(await codeOf(svc.verify(await build({}, { iss: "evil" }).sign(enc(SECRET))))).toBe("AUTH_INVALID_TOKEN");
    // Issuer mismatch is logged (without the token) so a misconfigured issuer is visible.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("issuer mismatch"));
    expect(warn.mock.calls.flat().join(" ")).not.toContain("eyJ");
    warn.mockRestore();
  });
});

describe("SupabaseJwtService — JWKS with HS256 fallback", () => {
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  const svc = () => new SupabaseJwtService(cfg({ SUPABASE_URL, SUPABASE_JWT_SECRET: SECRET }));

  beforeAll(async () => {
    const kp = await generateKeyPair("ES256");
    privateKey = kp.privateKey;
    localJwks = [{ ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "ES256" }];
    expect(createLocalJWKSet).toBeDefined();
  });

  const es = (o: Parameters<typeof build>[1] = {}) =>
    build({}, { iss: ISSUER, header: { alg: "ES256", kid: "k1" }, ...o }).sign(privateKey);

  it("verifies an ES256 token from JWKS with derived issuer", async () => {
    expect(await codeOf(svc().verify(await es()))).toBe("OK");
  });

  it("issuer derived from SUPABASE_URL rejects another iss", async () => {
    expect(await codeOf(svc().verify(await es({ iss: "https://other.supabase.co/auth/v1" })))).toBe(
      "AUTH_INVALID_TOKEN",
    );
  });

  it("falls back to HS256 when JWKS has no matching key", async () => {
    expect(await codeOf(svc().verify(await build({}, { iss: ISSUER }).sign(enc(SECRET))))).toBe("OK");
  });

  it("does not fall back when the JWKS token is expired → AUTH_TOKEN_EXPIRED", async () => {
    expect(await codeOf(svc().verify(await es({ exp: Math.floor(Date.now() / 1000) - 60 })))).toBe(
      "AUTH_TOKEN_EXPIRED",
    );
  });
});
