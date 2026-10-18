import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { MetricsService } from "./metrics.service";

/** Builds the low-cardinality route label: Express route template (e.g. `/api/v1/projects/:projectId`), never the raw URL. */
export function routeLabel(req: Pick<Request, "baseUrl"> & { route?: { path?: unknown } }): string {
  const path = req.route?.path;
  if (typeof path !== "string") return "unmatched";
  return `${req.baseUrl ?? ""}${path}` || "/";
}

/**
 * Counts every HTTP request on `finish` — including guard rejections (401/403) that interceptors never see.
 * `/metrics` scrapes are skipped (doc 09 §2).
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const route = routeLabel(req);
      if (route === "/metrics" || req.originalUrl.split("?")[0] === "/metrics") return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      this.metrics.observeHttp(route, req.method, res.statusCode, ms);
    });
    next();
  }
}
