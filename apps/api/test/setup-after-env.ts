import http from "node:http";
import { resolveTestDatabaseUrl } from "./helpers/test-db";
import { stripDevAuthEnv } from "./helpers/test-env";

process.env.NODE_ENV = "test";
// #266: tests must not inherit local Supabase auth from apps/api/.env (createTestApp also filters APP_CONFIG).
stripDevAuthEnv();
// Workers outside --runInBand may not inherit env set in globalSetup; derive the same URL deterministically (#189).
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.AUTH_TEST_JWT_SECRET ??= "test-secret-test-secret-test-secret";
process.env.PROVIDERS_MODE = "fake";
process.env.INTEGRATION_ENCRYPTION_KEYS ??= JSON.stringify({ k1: Buffer.alloc(32, 7).toString("base64") });
process.env.LOG_LEVEL ??= "error";
// Integration apps never start the collector tick on their own; scheduler tests call tick() explicitly (T-048).
// Assigned, not `??=`: a shell that exported APP_ROLE=all would otherwise start the scheduler in tests (#189).
process.env.APP_ROLE = "api";
// One connection per request: avoids keep-alive races with the suite-long server from createTestApp (#189).
http.globalAgent = new http.Agent({ keepAlive: false });
jest.setTimeout(30_000);
