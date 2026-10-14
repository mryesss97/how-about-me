import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../../src/config/config.module";
import type { PrismaService } from "../../src/database/prisma.service";
import { api, createActor } from "../helpers/actors";
import { createTestApp, resetDb } from "../helpers/app";
import { mintTestJwt } from "../helpers/auth";
import { TEST_STRIPPED_AUTH_VARS } from "../helpers/test-env";

/** #266: a dev apps/api/.env with local Supabase auth must not break test auth (FR-015 still enforced). */
describe("test env isolation from dev Supabase auth (#266)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const saved: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of TEST_STRIPPED_AUTH_VARS) saved[key] = process.env[key];
    // Simulate a copied dev .env pointing at local Supabase.
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.SUPABASE_JWT_SECRET = "some-other-secret-at-least-32-chars";
    process.env.SUPABASE_JWT_ISSUER = "http://127.0.0.1:54321/auth/v1";
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => resetDb(prisma));
  afterAll(async () => {
    for (const key of TEST_STRIPPED_AUTH_VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await app.close();
  });

  it("#266: test-signed token is accepted despite dev Supabase env → 200", async () => {
    const { token } = await createActor(prisma);
    const res = await api(app, token).get("/me");
    expect(res.status).toBe(200);
  });

  it("#266: APP_CONFIG excludes dev Supabase auth vars", () => {
    const cfg = app.get<AppConfig>(APP_CONFIG);
    for (const key of TEST_STRIPPED_AUTH_VARS) expect(cfg[key]).toBeUndefined();
  });

  it("#266: token signed with another secret is still rejected → 401 AUTH_INVALID_TOKEN", async () => {
    const token = await mintTestJwt({
      sub: randomUUID(),
      email: "x@example.com",
      secret: "some-other-secret-at-least-32-chars",
    });
    const res = await api(app, token).get("/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });
});
