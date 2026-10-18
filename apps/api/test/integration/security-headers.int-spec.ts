import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { APP_CONFIG } from "../../src/config/config.module";
import { createTestApp } from "../helpers/app";
import { loadTestEnv } from "../helpers/test-env";

/** T-121 security checklist #9 — NFR-016 CORS allow-list and helmet headers on the real HTTP pipeline. */
describe("Security headers & CORS (T-121, NFR-016)", () => {
  const ALLOWED = "https://app.example.com";
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(APP_CONFIG).useFactory({ factory: () => ({ ...loadTestEnv(), CORS_ORIGINS: ALLOWED }) }),
    }));
  });
  afterAll(async () => app.close());

  it("preflight from an allowed origin → access-control-allow-origin echoes it", async () => {
    const res = await http().options("/api/v1/me").set("Origin", ALLOWED).set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
  });

  it("preflight from an unknown origin → no access-control-allow-origin", async () => {
    const res = await http()
      .options("/api/v1/me")
      .set("Origin", "https://evil.example.org")
      .set("Access-Control-Request-Method", "POST");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responses carry helmet headers", async () => {
    const res = await http().get("/health/live");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
