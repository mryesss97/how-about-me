process.env.NODE_ENV = "test";
process.env.AUTH_TEST_JWT_SECRET ??= "test-secret-test-secret-test-secret";
process.env.PROVIDERS_MODE = "fake";
process.env.INTEGRATION_ENCRYPTION_KEYS ??= JSON.stringify({ k1: Buffer.alloc(32, 7).toString("base64") });
process.env.LOG_LEVEL ??= "error";
// Integration apps never start the collector tick on their own; scheduler tests call tick() explicitly (T-048).
process.env.APP_ROLE ??= "api";
jest.setTimeout(30_000);
