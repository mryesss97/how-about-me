import type { Params } from "nestjs-pino";
import { v7 as uuidv7 } from "uuid";
import type { AppConfig } from "../../config/config.module";

/** Redaction list — docs/02-architecture/08-security-secrets.md §5 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.accessToken",
  "*.access_token",
  "*.refresh_token",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
  "*.password",
  "*.serviceRoleKey",
  "*.ciphertext",
];

export function buildLoggerParams(cfg: AppConfig): Params {
  const pretty = cfg.NODE_ENV === "development";
  return {
    pinoHttp: {
      level: cfg.LOG_LEVEL,
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id = typeof existing === "string" && existing.length <= 128 ? existing : uuidv7();
        res.setHeader("x-request-id", id);
        return id;
      },
      customProps: (req) => ({
        request_id: (req as { id?: string }).id,
        app_role: cfg.APP_ROLE,
        version: cfg.APP_VERSION,
      }),
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
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
