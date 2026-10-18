import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { MetricsService } from "./metrics.service";

export const METRICS_LOG_INTERVAL_MS = 60_000;

/**
 * Periodic `metrics` log line when Prometheus cannot scrape this process (doc 09 §2):
 * METRICS_TOKEN unset (endpoint disabled) or APP_ROLE=worker (collector metrics live in the worker).
 */
@Injectable()
export class MetricsLogFallback implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly metrics: MetricsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MetricsLogFallback.name);
  }

  get enabled(): boolean {
    return !this.cfg.METRICS_TOKEN || this.cfg.APP_ROLE === "worker";
  }

  onModuleInit(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.flush(), METRICS_LOG_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flush(): Promise<void> {
    try {
      this.logger.info({ metrics: await this.metrics.snapshot() }, "metrics");
    } catch (err: unknown) {
      this.logger.warn({ err }, "metrics snapshot failed");
    }
  }
}
