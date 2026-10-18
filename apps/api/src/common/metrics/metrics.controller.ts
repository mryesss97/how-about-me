import { Controller, Get, Headers, Inject, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { Public } from "../auth/public.decorator";
import { AppError } from "../errors/app.error";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { checkMetricsToken, extractMetricsToken } from "./metrics-token";
import { MetricsService } from "./metrics.service";

/**
 * `GET /metrics` (outside `/api/v1`) — Prometheus text, protected by METRICS_TOKEN (FR-174, TC-SYS-010).
 * Read-only, so no `@Roles`; JWT is skipped and the scrape token is checked instead.
 * METRICS_TOKEN unset → 404 (endpoint disabled; MetricsLogFallback logs snapshots instead).
 */
@ApiExcludeController()
@Controller("metrics")
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  async scrape(
    @Headers("authorization") authorization: unknown,
    @Headers("x-metrics-token") headerToken: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const expected = this.cfg.METRICS_TOKEN;
    if (!expected) throw AppError.notFound("Route");
    const check = checkMetricsToken(extractMetricsToken(authorization, headerToken), expected);
    if (check === "missing") throw new AppError("AUTH_MISSING_TOKEN", "Metrics token required");
    if (check === "invalid") throw new AppError("AUTH_INVALID_TOKEN", "Invalid metrics token");
    res.type(this.metrics.contentType).send(await this.metrics.render());
  }
}
