import { InternalServerErrorException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import type { Logger } from "nestjs-pino";
import { z } from "zod";
import type { AppConfig } from "../../config/config.module";
import { AppError } from "./app.error";
import { HttpExceptionFilter } from "./http-exception.filter";

function run(exception: unknown, nodeEnv: AppConfig["NODE_ENV"] = "production") {
  const logger = { error: jest.fn(), debug: jest.fn() } as unknown as Logger;
  const filter = new HttpExceptionFilter(logger, { NODE_ENV: nodeEnv } as AppConfig);
  const out: { status?: number; body?: unknown } = {};
  const res = {
    status(s: number) {
      out.status = s;
      return this;
    },
    json(b: unknown) {
      out.body = b;
      return this;
    },
  };
  const req = { id: "req-1", url: "/x", headers: { "x-request-id": "spoofed" } };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  filter.catch(exception, host);
  return { status: out.status, body: out.body as { error: Record<string, unknown> } & Record<string, unknown> };
}

describe("HttpExceptionFilter (backend-design §5, NFR-015)", () => {
  it("maps AppError to its status/code and uses req.id", () => {
    const { status, body } = run(AppError.notFound("Project"));
    expect(status).toBe(404);
    expect(body.error).toMatchObject({ code: "NOT_FOUND", message: "Project not found", requestId: "req-1" });
  });

  it("maps ZodError to 400 VALIDATION_ERROR with field paths", () => {
    const r = z.object({ body: z.object({ email: z.email() }), items: z.array(z.object({ name: z.string() })) });
    const err = r.safeParse({ body: { email: "x" }, items: [{}] }).error;
    const { status, body } = run(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const paths = (body.error.details as { issues: { path: string }[] }).issues.map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["body.email", "items.0.name"]));
  });

  it("hides unknown error message and stack in production", () => {
    const { status, body } = run(new Error("db password=hunter2"));
    expect(status).toBe(500);
    expect(body.error).toEqual({ code: "INTERNAL", message: "Internal server error", requestId: "req-1" });
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("hides HttpException 5xx messages; dev exposes debug message without stack", () => {
    expect(run(new InternalServerErrorException("leak")).body.error.message).toBe("Internal server error");
    expect(JSON.stringify(run(new InternalServerErrorException("leak"), "staging").body)).not.toContain("leak");
    const dev = run(new Error("boom"), "development").body;
    expect(dev.error.details).toEqual({ debug: { message: "boom" } });
    expect(JSON.stringify(dev)).not.toContain("at ");
  });

  it("maps ThrottlerException to RATE_LIMITED and 404 to NOT_FOUND", () => {
    expect(run(new ThrottlerException()).body.error.code).toBe("RATE_LIMITED");
    expect(run(new NotFoundException()).body.error.code).toBe("NOT_FOUND");
  });

  it("passes Terminus 503 health body through unwrapped (TC-SYS-007)", () => {
    const health = {
      status: "error",
      info: {},
      error: { database: { status: "down" } },
      details: { database: { status: "down" } },
    };
    const { status, body } = run(new ServiceUnavailableException(health));
    expect(status).toBe(503);
    expect(body).toEqual(health);
  });
});
