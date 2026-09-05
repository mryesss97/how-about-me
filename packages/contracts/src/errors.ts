import { z } from "zod";

/** Stable error codes — docs/02-architecture/05-api-contract.md §13. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  QUERY_IMMUTABLE_FIELD: 400,
  BACKFILL_WINDOW_INVALID: 400,
  AUTH_MISSING_TOKEN: 401,
  AUTH_INVALID_TOKEN: 401,
  AUTH_TOKEN_EXPIRED: 401,
  FORBIDDEN_ROLE: 403,
  FORBIDDEN_PROJECT: 403,
  NOT_FOUND: 404,
  QUERY_DUPLICATE: 409,
  SYNC_ALREADY_RUNNING: 409,
  LAST_ADMIN: 409,
  ANALYSIS_ALREADY_PENDING: 409,
  INTEGRATION_NOT_CONFIGURED: 409,
  EXPORT_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  THREADS_UNAUTHORIZED: 502,
  THREADS_FORBIDDEN: 502,
  THREADS_UPSTREAM_ERROR: 502,
  THREADS_MALFORMED_RESPONSE: 502,
  THREADS_RATE_LIMITED: 503,
  THREADS_TIMEOUT: 503,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;
export const ErrorCodeSchema = z.enum(Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]);

export const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
