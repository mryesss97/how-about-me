import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { APP_CONFIG } from "../../src/config/config.module";
import { createTestApp } from "../helpers/app";
import { loadTestEnv } from "../helpers/test-env";

const TOKEN = "test-metrics-token";

/** T-058 / FR-174 / TC-SYS-010: Prometheus text with listed metrics; 401 without token. */
describe("GET /metrics (T-058)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(APP_CONFIG).useFactory({ factory: () => ({ ...loadTestEnv(), METRICS_TOKEN: TOKEN }) }),
    }));
  });
  afterAll(async () => app.close());

  it("401 AUTH_MISSING_TOKEN without token", async () => {
    const res = await request(app.getHttpServer()).get("/metrics");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: "AUTH_MISSING_TOKEN", requestId: expect.any(String) });
  });

  it("401 AUTH_INVALID_TOKEN with wrong token", async () => {
    const res = await request(app.getHttpServer()).get("/metrics").set("authorization", "Bearer wrong");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_TOKEN");
  });

  it("200 Prometheus text with listed metrics (Bearer and x-metrics-token)", async () => {
    await request(app.getHttpServer()).get("/health/live").expect(200);
    const res = await request(app.getHttpServer()).get("/metrics").set("authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    for (const name of [
      "collector_sync_jobs_total",
      "collector_provider_requests_total",
      "collector_provider_request_duration_ms",
      "collector_records_total",
      "collector_rate_limit_events_total",
      "collector_circuit_open",
      "http_requests_total",
      "http_request_duration_ms",
      "analysis_runs_total",
      "analysis_queue_depth",
      "analysis_run_duration_ms",
      "analysis_provider_calls_total",
      "analysis_tokens_total",
      "analysis_estimated_cost_usd_total",
    ])
      expect(res.text).toContain(`# HELP ${name}`);
    expect(res.text).toContain('http_requests_total{route="/health/live",method="GET",status="200"}');
    await request(app.getHttpServer()).get("/metrics").set("x-metrics-token", TOKEN).expect(200);
  });
});

/** METRICS_TOKEN unset → the endpoint is disabled (404); snapshots go to the log instead (FR-174). */
describe("GET /metrics without METRICS_TOKEN (T-058)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp({
      customize: (b) =>
        b.overrideProvider(APP_CONFIG).useFactory({ factory: () => ({ ...loadTestEnv(), METRICS_TOKEN: undefined }) }),
    }));
  });
  afterAll(async () => app.close());

  it("404 NOT_FOUND even with a token", async () => {
    const res = await request(app.getHttpServer()).get("/metrics").set("authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
