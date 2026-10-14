import { isSwaggerEnabled, loadEnv } from "./env.schema";

const base = { NODE_ENV: "test", DATABASE_URL: "postgres://x" };
const prod = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://x",
  SUPABASE_URL: "https://x.supabase.co",
  INTEGRATION_ENCRYPTION_KEYS: '{"k1":"AAAA"}',
  CORS_ORIGINS: "https://app.example.com",
};

describe("loadEnv fail-fast", () => {
  it("accepts a minimal test env", () => {
    expect(loadEnv(base).DATABASE_URL).toBe("postgres://x");
  });

  it("defaults the shared OpenAI settings (T-071)", () => {
    const env = loadEnv(base);
    expect(env.OPENAI_BASE_URL).toBe("https://api.openai.com/v1");
    expect(env.OPENAI_TIMEOUT_MS).toBe(15000);
    expect(env.OPENAI_MAX_RETRIES).toBe(2);
  });

  it("FR-120: ANALYSIS_PROMPT_VERSION defaults to classifier-v2, accepts v1, rejects unknown", () => {
    expect(loadEnv(base).ANALYSIS_PROMPT_VERSION).toBe("classifier-v2");
    expect(loadEnv({ ...base, ANALYSIS_PROMPT_VERSION: "classifier-v1" }).ANALYSIS_PROMPT_VERSION).toBe(
      "classifier-v1",
    );
    expect(() => loadEnv({ ...base, ANALYSIS_PROMPT_VERSION: "classifier-v9" })).toThrow(/ANALYSIS_PROMPT_VERSION/);
  });

  it("retention job defaults to off, Sunday 03:00 Asia/Ho_Chi_Minh (T-153, NFR-054)", () => {
    const env = loadEnv(base);
    expect(env.RETENTION_JOB_MODE).toBe("off");
    expect(env.RETENTION_JOB_CRON).toBe("0 3 * * 0");
    expect(env.RETENTION_JOB_TIMEZONE).toBe("Asia/Ho_Chi_Minh");
  });

  it.each([
    ["unknown mode", { RETENTION_JOB_MODE: "yes" }],
    ["invalid cron", { RETENTION_JOB_CRON: "every sunday" }],
    ["zero retention days", { RETENTION_POSTS_DAYS: "0" }],
    ["negative retention days", { RETENTION_RUNS_DAYS: "-5" }],
  ])("rejects retention misconfiguration: %s (T-153)", (_n, extra) => {
    expect(() => loadEnv({ ...base, ...extra })).toThrow();
  });

  it("lists missing DATABASE_URL by path", () => {
    expect(() => loadEnv({ NODE_ENV: "test" })).toThrow(/DATABASE_URL/);
  });

  it("requires OPENAI_API_KEY in production + real mode", () => {
    expect(() => loadEnv({ ...prod, PROVIDERS_MODE: "real", ANALYSIS_CLASSIFIER_MODEL: "m" })).toThrow(
      /OPENAI_API_KEY: required in real mode/,
    );
  });

  it("requires INTEGRATION_ENCRYPTION_KEYS in production", () => {
    expect(() => loadEnv({ ...prod, INTEGRATION_ENCRYPTION_KEYS: undefined })).toThrow(/INTEGRATION_ENCRYPTION_KEYS/);
  });

  it("rejects non-JSON INTEGRATION_ENCRYPTION_KEYS", () => {
    expect(() => loadEnv({ ...base, INTEGRATION_ENCRYPTION_KEYS: "nope" })).toThrow(/must be JSON/);
  });

  it("rejects wildcard CORS in production (NFR-016)", () => {
    expect(() => loadEnv({ ...prod, CORS_ORIGINS: "*" })).toThrow(/CORS_ORIGINS/);
    expect(loadEnv({ ...base, CORS_ORIGINS: "*" }).CORS_ORIGINS).toBe("*");
  });

  it("never echoes secret values in the error (NFR-014)", () => {
    const secret = "sk-super-secret-value";
    try {
      loadEnv({ ...prod, LOG_LEVEL: secret, SUPABASE_JWT_SECRET: "short" });
      throw new Error("expected throw");
    } catch (e) {
      expect((e as Error).message).toMatch(/Invalid environment configuration/);
      expect((e as Error).message).not.toContain(secret);
    }
  });
});

describe("isSwaggerEnabled (backend-design §9)", () => {
  it("defaults on outside production and off in production", () => {
    expect(isSwaggerEnabled(loadEnv(base))).toBe(true);
    expect(isSwaggerEnabled(loadEnv(prod))).toBe(false);
  });

  it("honours explicit SWAGGER_ENABLED", () => {
    expect(isSwaggerEnabled(loadEnv({ ...prod, SWAGGER_ENABLED: "true" }))).toBe(true);
    expect(isSwaggerEnabled(loadEnv({ ...base, SWAGGER_ENABLED: "false" }))).toBe(false);
  });
});
