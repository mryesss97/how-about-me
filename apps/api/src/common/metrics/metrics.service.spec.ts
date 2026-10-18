import { MetricsService } from "./metrics.service";

/** FR-174 / doc 09 §2: metric names + labels rendered as Prometheus text. */
describe("MetricsService", () => {
  it("renders every M2 metric with HELP and recorded labels", async () => {
    const m = new MetricsService();
    m.incSyncJob("success", "manual");
    m.observeProviderRequest("threads", "ok", 120);
    m.addRecords("inserted", 3);
    m.incRateLimit("threads");
    m.setCircuitOpen("p1", true);
    m.observeHttp("/api/v1/projects/:projectId", "GET", 200, 12);
    const text = await m.render();
    for (const name of [
      "collector_sync_jobs_total",
      "collector_provider_requests_total",
      "collector_provider_request_duration_ms",
      "collector_records_total",
      "collector_rate_limit_events_total",
      "collector_circuit_open",
      "http_requests_total",
      "http_request_duration_ms",
    ])
      expect(text).toContain(`# HELP ${name}`);
    expect(text).toContain('collector_sync_jobs_total{status="success",trigger="manual"} 1');
    expect(text).toContain('collector_records_total{kind="inserted"} 3');
    expect(text).toContain('collector_circuit_open{project="p1"} 1');
    expect(text).toContain('http_requests_total{route="/api/v1/projects/:projectId",method="GET",status="200"} 1');
  });

  it("registries are isolated between instances", async () => {
    new MetricsService().incSyncJob("failed", "scheduled");
    expect(await new MetricsService().render()).not.toContain('status="failed"');
  });

  it("snapshot drops histogram buckets, keeps sum/count", async () => {
    const m = new MetricsService();
    m.observeHttp("/x", "GET", 200, 5);
    const snap = await m.snapshot();
    const series = (snap["http_request_duration_ms"] ?? []).map((v) => v.labels["series"]);
    expect(series).toEqual(expect.arrayContaining(["sum", "count"]));
    expect(series).not.toContain("bucket");
  });

  it("FR-174 / #310: renders analysis_* metrics and ignores non-positive usage", async () => {
    const m = new MetricsService();
    m.incAnalysisRun("completed", "ingest");
    m.setAnalysisQueueDepth("pending", 4);
    m.observeAnalysisDuration("classify", 300);
    m.incAnalysisProviderCall("openai", "ANALYSIS_PROVIDER_ERROR");
    m.addAnalysisUsage("openai", { inputTokens: 0, outputTokens: -1, estimatedCostUsd: Number.NaN });
    m.addAnalysisUsage("openai", { inputTokens: 10, outputTokens: 4, estimatedCostUsd: 0.1 });
    m.addAnalysisUsage("openai", { inputTokens: 5, outputTokens: 0, estimatedCostUsd: 0.2 });
    const text = await m.render();
    for (const name of [
      "analysis_runs_total",
      "analysis_queue_depth",
      "analysis_run_duration_ms",
      "analysis_provider_calls_total",
      "analysis_tokens_total",
      "analysis_estimated_cost_usd_total",
    ])
      expect(text).toContain(`# HELP ${name}`);
    expect(text).toContain('analysis_runs_total{status="completed",trigger="ingest"} 1');
    expect(text).toContain('analysis_queue_depth{status="pending"} 4');
    expect(text).toContain('analysis_provider_calls_total{provider="openai",outcome="ANALYSIS_PROVIDER_ERROR"} 1');
    expect(text).toContain('analysis_tokens_total{direction="input"} 15');
    expect(text).toContain('analysis_tokens_total{direction="output"} 4');
    const snap = await m.snapshot();
    expect(snap["analysis_estimated_cost_usd_total"]?.[0]?.value).toBeCloseTo(0.3);
    expect(Object.keys(snap)).toEqual(expect.arrayContaining(["analysis_runs_total", "analysis_tokens_total"]));
  });
});
