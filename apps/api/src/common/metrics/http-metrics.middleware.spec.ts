import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import { HttpMetricsMiddleware, routeLabel } from "./http-metrics.middleware";
import { MetricsService } from "./metrics.service";

/** FR-174 / doc 09 §2: low-cardinality route label. */
describe("HttpMetricsMiddleware", () => {
  function run(req: Partial<Request> & { route?: { path: string } }, status = 200) {
    const metrics = new MetricsService();
    const res = Object.assign(new EventEmitter(), { statusCode: status });
    new HttpMetricsMiddleware(metrics).use(
      { method: "GET", baseUrl: "", originalUrl: "/", ...req } as Request,
      res as unknown as Response,
      jest.fn() as NextFunction,
    );
    res.emit("finish");
    return metrics.render();
  }

  it("uses the route template, not the raw URL", async () => {
    const text = await run({
      originalUrl: "/api/v1/projects/abc-123",
      route: { path: "/api/v1/projects/:projectId" },
    });
    expect(text).toContain('route="/api/v1/projects/:projectId"');
    expect(text).not.toContain("abc-123");
  });

  it("unmatched routes and /metrics", async () => {
    expect(await run({ originalUrl: "/nope" }, 404)).toContain('route="unmatched",method="GET",status="404"');
    expect(await run({ originalUrl: "/metrics", route: { path: "/metrics" } })).not.toMatch(/^http_requests_total\{/m);
  });

  it("routeLabel joins baseUrl", () => {
    expect(routeLabel({ baseUrl: "/a", route: { path: "/b" } })).toBe("/a/b");
  });
});
