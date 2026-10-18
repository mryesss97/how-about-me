import { Injectable } from "@nestjs/common";
import { Counter, Gauge, Histogram, Registry } from "prom-client";

export type ProviderOutcome = "ok" | "rate_limited" | "error" | "timeout";
export type RecordKind = "fetched" | "inserted" | "updated" | "duplicated" | "invalid" | "excluded";
export type SyncJobStatus = "success" | "partial" | "failed";
export type SyncTrigger = "scheduled" | "manual";

const MS_BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

/** Compact per-series value for the periodic log fallback (histograms keep only sum/count). */
export type MetricSnapshot = Record<string, Array<{ labels: Record<string, string | number>; value: number }>>;

/**
 * Prometheus metrics — docs/02-architecture/09-observability.md §2 (FR-174, TC-SYS-010).
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
