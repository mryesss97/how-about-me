import type { IncomingMessage } from "node:http";
import type { Params } from "nestjs-pino";
import type { AppConfig } from "../../config/config.module";
import { resolveRequestId } from "./request-id";

/**
 * Redaction list — docs/02-architecture/08-security-secrets.md §5 (NFR-014).
 * pino wildcards match exactly ONE level, so deeply nested provider objects are not covered:
 * provider code must sanitize/truncate payloads (≤500 chars) before logging, never log raw responses.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  "err.config.headers.authorization",
  "*.authorization",
  "*.Authorization",
  "*.headers.authorization",
  "*.*.headers.authorization",
  "*.accessToken",
  "*.access_token",
  "*.refreshToken",
  "*.refresh_token",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
  "*.client_secret",
  "*.clientSecret",
  "*.appSecret",
  "*.privateKey",
  "*.password",
  "*.serviceRoleKey",
  "*.ciphertext",
];

export const REDACT_CENSOR = "[REDACTED]";

export function buildRedactOptions() {
  return { paths: [...REDACT_PATHS], censor: REDACT_CENSOR };
}

type LoggedRequest = IncomingMessage & {
  id?: string;
  user?: { id?: string };
  params?: Record<string, string | undefined>;
};

export function buildLoggerParams(cfg: AppConfig): Params {
  const pretty = cfg.NODE_ENV === "development";
  return {
    pinoHttp: {
      level: cfg.LOG_LEVEL,
      genReqId: (req, res) => {
        const id = resolveRequestId(req.headers["x-request-id"]);
        res.setHeader("x-request-id", id);
        return id;
      },
      customAttributeKeys: { reqId: "request_id", responseTime: "duration_ms" },
      // Evaluated again when the response finishes, so guard-populated req.user / params are present.
      customProps: (req) => {
        const r = req as LoggedRequest;
        return {
          app_role: cfg.APP_ROLE,
          version: cfg.APP_VERSION,
          ...(r.user?.id ? { user_id: r.user.id } : {}),
          ...(r.params?.projectId ? { project_id: r.params.projectId } : {}),
        };
      },
      redact: buildRedactOptions(),
      autoLogging: { ignore: (req) => (req.url ?? "").startsWith("/health") || (req.url ?? "").startsWith("/metrics") },
      serializers: {
        req: (req: { id?: string; method?: string; url?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      transport: pretty
        ? { target: "pino-pretty", options: { colorize: true, singleLine: true, translateTime: "SYS:HH:MM:ss" } }
        : undefined,
    },
  };
}
