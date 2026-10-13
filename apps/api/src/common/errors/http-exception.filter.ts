import { ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Inject } from "@nestjs/common";
import type { Request, Response } from "express";
import { Logger } from "nestjs-pino";
import { ZodError } from "zod";
import type { ApiErrorEnvelope, ErrorCode } from "@how-about-me/contracts";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { AppError } from "./app.error";

const GENERIC_5XX = "Internal server error";

type LoggableRequest = Request & { id?: string; log?: { error: (o: object, m: string) => void } };

/** Terminus `HealthCheckResult` body thrown as 503 by `/health/ready` — passed through untouched (TC-SYS-007). */
function isHealthCheckBody(body: unknown): body is Record<string, unknown> {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (b.status === "error" || b.status === "shutting_down") && typeof b.details === "object";
}

function codeForStatus(status: number): ErrorCode {
  if (status === 401) return "AUTH_INVALID_TOKEN";
  if (status === 403) return "FORBIDDEN_ROLE";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "INTERNAL";
  // 400/405/409/413… map to VALIDATION_ERROR until contracts define dedicated codes.
  return "VALIDATION_ERROR";
}

function retryAfterSeconds(details: unknown): number | undefined {
  if (typeof details !== "object" || details === null) return undefined;
  const v = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;
}

/**
 * Maps every error to `{ error: { code, message, requestId, details? } }` — docs/02-architecture/02-backend-design.md §5.
 * 5xx never expose the original message or stack; dev/test add `details.debug.message` only.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<LoggableRequest>();
    // Same id pino-http assigned and echoed in the `x-request-id` header.
    const requestId = req.id ?? "unknown";

    if (exception instanceof HttpException && isHealthCheckBody(exception.getResponse())) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = "INTERNAL";
    let message = GENERIC_5XX;
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
      code = codeForStatus(status);
      const body = exception.getResponse();
      const raw = typeof body === "string" ? body : (body as { message?: unknown }).message;
      message = Array.isArray(raw) ? raw.map(String).join("; ") : typeof raw === "string" ? raw : exception.message;
    }

    if (status >= 500) {
      // AppError messages are deliberate (e.g. THREADS_*); anything else is hidden in every env and
      // non-prod gets the original message (never the stack) to ease debugging.
      if (!(exception instanceof AppError)) {
        const original = exception instanceof Error ? exception.message : String(exception);
        message = GENERIC_5XX;
        details =
          this.cfg.NODE_ENV === "production" || this.cfg.NODE_ENV === "staging"
            ? undefined
            : { debug: { message: original } };
      }
      const payload = { err: exception, error_code: code, path: req.url };
      if (req.log) req.log.error(payload, "unhandled error");
      else this.logger.error(payload, "unhandled error");
    } else {
      this.logger.debug({ error_code: code, status, request_id: requestId, path: req.url }, "request failed");
    }

    const envelope: ApiErrorEnvelope = {
      error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
    };
    // api-contract §1: 429 carries `Retry-After` when the domain error knows the wait (T-145).
    const retryAfter = status === 429 ? retryAfterSeconds(details) : undefined;
    if (retryAfter !== undefined) res.setHeader("Retry-After", String(retryAfter));
    res.status(status).json(envelope);
  }
}
