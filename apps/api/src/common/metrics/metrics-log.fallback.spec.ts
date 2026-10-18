import type { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../../config/config.module";
import { METRICS_LOG_INTERVAL_MS, MetricsLogFallback } from "./metrics-log.fallback";
import { MetricsService } from "./metrics.service";

/** FR-174 / doc 09 §2: periodic `metrics` log when scraping is not possible. */
describe("MetricsLogFallback", () => {
  afterEach(() => jest.useRealTimers());

  function make(cfg: Partial<AppConfig>) {
    const logger = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn() };
    const fb = new MetricsLogFallback(
      new MetricsService(),
      { APP_ROLE: "all", ...cfg } as AppConfig,
      logger as unknown as PinoLogger,
    );
    return { fb, logger };
  }

  it("token unset → logs `metrics` each interval", async () => {
    jest.useFakeTimers();
    const { fb, logger } = make({});
    fb.onModuleInit();
    await jest.advanceTimersByTimeAsync(METRICS_LOG_INTERVAL_MS);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ metrics: expect.any(Object) }), "metrics");
    fb.onModuleDestroy();
  });

  it("token set → no log; worker role → logs regardless", async () => {
    jest.useFakeTimers();
    const a = make({ METRICS_TOKEN: "t" });
    a.fb.onModuleInit();
    await jest.advanceTimersByTimeAsync(METRICS_LOG_INTERVAL_MS * 2);
    expect(a.logger.info).not.toHaveBeenCalled();
    expect(make({ METRICS_TOKEN: "t", APP_ROLE: "worker" }).fb.enabled).toBe(true);
  });
});
