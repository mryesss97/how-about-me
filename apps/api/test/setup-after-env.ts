process.env.NODE_ENV = "test";
process.env.AUTH_TEST_JWT_SECRET ??= "test-secret-test-secret-test-secret";
process.env.PROVIDERS_MODE = "fake";
process.env.INTEGRATION_ENCRYPTION_KEYS ??= JSON.stringify({ k1: Buffer.alloc(32, 7).toString("base64") });
process.env.SWAGGER_ENABLED = "false";
process.env.LOG_LEVEL ??= "error";
jest.setTimeout(30_000);
