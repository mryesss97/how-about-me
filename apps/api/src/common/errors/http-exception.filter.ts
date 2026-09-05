import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { Logger } from "nestjs-pino";
import { ZodError } from "zod";
import type { ApiErrorEnvelope, ErrorCode } from "@how-about-me/contracts";
import { AppError } from "./app.error";

/** Maps every error to the API envelope `{ error: { code, message, requestId, details? } }`. Never leaks stacks. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = (req.headers["x-request-id"] as string | undefined) ?? req.id ?? "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = "INTERNAL";
    let message = "Internal server error";
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = "Validation failed";
      details = { issues: exception.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })) };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === "string"
          ? body
          : ((body as { message?: string | string[] }).message?.toString() ?? exception.message);
      code =
        status === 401
          ? "AUTH_INVALID_TOKEN"
          : status === 403
            ? "FORBIDDEN_ROLE"
            : status === 404
              ? "NOT_FOUND"
              : status === 429
                ? "RATE_LIMITED"
                : status >= 500
                  ? "INTERNAL"
                  : "VALIDATION_ERROR";
    }

    if (status >= 500) this.logger.error({ err: exception, requestId, path: req.url }, "unhandled error");
    else this.logger.debug({ code, status, requestId, path: req.url }, "request failed");

    const envelope: ApiErrorEnvelope = {
      error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
    };
    res.status(status).json(envelope);
  }
}
