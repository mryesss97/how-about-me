import { Injectable } from "@nestjs/common";
import { Counter, Gauge, Histogram, Registry } from "prom-client";

export type ProviderOutcome = "ok" | "rate_limited" | "error" | "timeout";
export type RecordKind = "fetched" | "inserted" | "updated" | "duplicated" | "invalid" | "excluded";
export type SyncJobStatus = "success" | "partial" | "failed";
export type SyncTrigger = "scheduled" | "manual" | "retry" | "backfill";
/** `analysis_runs_total.status`: terminal outcomes plus `retried` (requeued after a retryable failure). */
export type AnalysisRunOutcome = "completed" | "skipped" | "failed" | "retried";
export type AnalysisStep = "relevance" | "safety" | "classify" | "total";
export type AnalysisQueueStatus = "pending" | "processing";
/** Mirrors the `AnalysisTrigger` enum; kept as a literal union so `common/` stays Prisma-free. */
export type AnalysisRunTrigger = "ingest" | "content_change" | "manual" | "bulk" | "retry" | "version_change";

const MS_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

/** Compact per-series value for the periodic log fallback (histograms keep only sum/count). */
export type MetricSnapshot = Record<string, Array<{ labels: Record<string, string | number>; value: number }>>;

/**
 * Prometheus metrics — docs/02-architecture/09-observability.md §2 (FR-174, TC-SYS-010).
 * Collector (`collector_*`), HTTP (`http_*`) and analysis (`analysis_*`, #310) series.
 * Own `Registry` per instance (not the prom-client global) so test apps stay isolated.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  private readonly syncJobs = new Counter({
    name: "collector_sync_jobs_total",
    help: "Collector sync jobs finished, by status and trigger",
    labelNames: ["status", "trigger"] as const,
    registers: [this.registry],
  });
  private readonly providerRequests = new Counter({
    name: "collector_provider_requests_total",
    help: "Provider search requests, by provider and outcome",
    labelNames: ["provider", "outcome"] as const,
    registers: [this.registry],
  });
  private readonly providerDuration = new Histogram({
    name: "collector_provider_request_duration_ms",
    help: "Provider search request duration in milliseconds",
    labelNames: ["provider"] as const,
    buckets: MS_BUCKETS,
    registers: [this.registry],
  });
  private readonly records = new Counter({
    name: "collector_records_total",
    help: "Collector records processed, by kind",
    labelNames: ["kind"] as const,
    registers: [this.registry],
  });
  private readonly rateLimits = new Counter({
    name: "collector_rate_limit_events_total",
    help: "Provider rate-limit events, by provider",
    labelNames: ["provider"] as const,
    registers: [this.registry],
  });
  private readonly circuitOpen = new Gauge({
    name: "collector_circuit_open",
    help: "1 when the project's collector circuit is open (FR-084)",
    labelNames: ["project"] as const,
    registers: [this.registry],
  });
  private readonly httpRequests = new Counter({
    name: "http_requests_total",
    help: "HTTP requests, by route template, method and status",
    labelNames: ["route", "method", "status"] as const,
    registers: [this.registry],
  });
  private readonly httpDuration = new Histogram({
    name: "http_request_duration_ms",
    help: "HTTP request duration in milliseconds, by route template",
    labelNames: ["route"] as const,
    buckets: MS_BUCKETS,
    registers: [this.registry],
  });

  private readonly analysisRuns = new Counter({
    name: "analysis_runs_total",
    help: "Analysis runs finished or requeued, by status and trigger",
    labelNames: ["status", "trigger"] as const,
    registers: [this.registry],
  });
  private readonly analysisQueueDepth = new Gauge({
    name: "analysis_queue_depth",
    help: "Analysis runs waiting or in progress (system-wide), by status",
    labelNames: ["status"] as const,
    registers: [this.registry],
  });
  private readonly analysisDuration = new Histogram({
    name: "analysis_run_duration_ms",
    help: "Analysis duration in milliseconds, by step (relevance, safety, classify, total)",
    labelNames: ["step"] as const,
    buckets: MS_BUCKETS,
    registers: [this.registry],
  });
  private readonly analysisProviderCalls = new Counter({
    name: "analysis_provider_calls_total",
    help: "AI provider calls, by provider and outcome (ok or error code)",
    labelNames: ["provider", "outcome"] as const,
    registers: [this.registry],
  });
  private readonly analysisTokens = new Counter({
    name: "analysis_tokens_total",
    help: "Classifier tokens of completed analysis runs, by direction",
    labelNames: ["direction"] as const,
    registers: [this.registry],
  });
  private readonly analysisCost = new Counter({
    name: "analysis_estimated_cost_usd_total",
    help: "Estimated provider cost (USD) of completed analysis runs, by provider",
    labelNames: ["provider"] as const,
    registers: [this.registry],
  });

  incAnalysisRun(status: AnalysisRunOutcome, trigger: AnalysisRunTrigger): void {
    this.analysisRuns.inc({ status, trigger });
  }

  setAnalysisQueueDepth(status: AnalysisQueueStatus, n: number): void {
    this.analysisQueueDepth.set({ status }, n);
  }

  observeAnalysisDuration(step: AnalysisStep, ms: number): void {
    this.analysisDuration.observe({ step }, ms);
  }

  incAnalysisProviderCall(provider: string, outcome: string): void {
    this.analysisProviderCalls.inc({ provider, outcome });
  }

  /** Only positive finite amounts are added (prom-client rejects negative increments). */
  addAnalysisUsage(
    provider: string,
    usage: { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number },
  ): void {
    const add = (n: number | undefined, inc: (v: number) => void) => {
      if (n !== undefined && Number.isFinite(n) && n > 0) inc(n);
    };
    add(usage.inputTokens, (v) => this.analysisTokens.inc({ direction: "input" }, v));
    add(usage.outputTokens, (v) => this.analysisTokens.inc({ direction: "output" }, v));
    add(usage.estimatedCostUsd, (v) => this.analysisCost.inc({ provider }, v));
  }

  incSyncJob(status: SyncJobStatus, trigger: SyncTrigger): void {
    this.syncJobs.inc({ status, trigger });
  }

  observeProviderRequest(provider: string, outcome: ProviderOutcome, ms: number): void {
    this.providerRequests.inc({ provider, outcome });
    this.providerDuration.observe({ provider }, ms);
  }

  addRecords(kind: RecordKind, n: number): void {
    if (n > 0) this.records.inc({ kind }, n);
  }

  incRateLimit(provider: string): void {
    this.rateLimits.inc({ provider });
  }

  setCircuitOpen(projectId: string, open: boolean): void {
    this.circuitOpen.set({ project: projectId }, open ? 1 : 0);
  }

  observeHttp(route: string, method: string, status: number, ms: number): void {
    this.httpRequests.inc({ route, method, status: String(status) });
    this.httpDuration.observe({ route }, ms);
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }

  async snapshot(): Promise<MetricSnapshot> {
    const out: MetricSnapshot = {};
    for (const m of await this.registry.getMetricsAsJSON()) {
      const values = m.values
        .filter((v) => {
          const name = (v as { metricName?: string }).metricName;
          return name === undefined || !name.endsWith("_bucket");
        })
        .map((v) => {
          const name = (v as { metricName?: string }).metricName;
          const suffix = name && name !== m.name ? name.slice(m.name.length) : "";
          const labels: Record<string, string | number> = {};
          for (const [k, val] of Object.entries(v.labels)) if (val !== undefined) labels[k] = val;
          if (suffix) labels["series"] = suffix.replace(/^_/, "");
          return { labels, value: v.value };
        });
      if (values.length > 0) out[m.name] = values;
    }
    return out;
  }
}
