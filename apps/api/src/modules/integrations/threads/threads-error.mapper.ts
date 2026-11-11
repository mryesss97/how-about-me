import { parseRetryAfter, ProviderError } from "../../../common/errors/provider.error";

/**
 * Threads/Graph error → `THREADS_*` code — docs/02-architecture/06-ingestion-pipeline.md §2/§7 (FR-082, TC-COL-017).
 *
 * The Graph `error.code` in the body wins over the HTTP status (Meta returns code 190 with HTTP 400).
 * Only the allow-listed `error.type`/`error.code`/`error_subcode` reach the message or `subcode`; the free-text
 * `error.message` is never copied because it can echo the query or a token (BR-036).
 */
const UNAUTHORIZED_CODES = new Set([190]);
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const TRANSIENT_CODES = new Set([1, 2]);
const MAX_SAMPLE = 200;

type GraphError = { type?: string; code?: number; subcode?: number; fbtraceId?: string; transient?: boolean };

/** Strips anything that looks like a token from upstream text before it is kept anywhere (BR-036). */
export function redact(text: string): string {
  return text
    .replace(/(access_token|input_token|client_secret)=[^&\s"']*/gi, "$1=***")
    .replace(/Bearer\s+[A-Za-z0-9._|~+/=-]+/gi, "Bearer ***");
}

function readGraphError(bodyText: string): GraphError {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const err = (parsed as { error?: unknown }).error;
    if (!err || typeof err !== "object") return {};
    const e = err as Record<string, unknown>;
    const out: GraphError = {};
    if (typeof e["type"] === "string") out.type = e["type"].slice(0, 100);
    if (typeof e["code"] === "number") out.code = e["code"];
    if (typeof e["error_subcode"] === "number") out.subcode = e["error_subcode"];
    if (typeof e["fbtrace_id"] === "string") out.fbtraceId = e["fbtrace_id"].slice(0, 100);
    if (e["is_transient"] === true) out.transient = true;
    return out;
  } catch {
    return {};
  }
}

/** Maps a non-2xx Threads response. `path` is the endpoint path only — never the full URL (it may carry `input_token`). */
export function toThreadsError(status: number, bodyText: string, headers: Headers, path: string): ProviderError {
  const g = readGraphError(bodyText);
  const subcodeParts = [g.code !== undefined ? `${g.code}/${g.subcode ?? ""}` : undefined, g.fbtraceId].filter(
    (v): v is string => typeof v === "string",
  );
  const summary = [g.type, g.code].filter((v) => v !== undefined).join("/");
  const message = `Threads HTTP ${status} on ${path}${summary ? `: ${summary}` : ""}`;
  const base = { providerStatus: status, ...(subcodeParts.length ? { subcode: subcodeParts.join(" ") } : {}) };
  const code = g.code;

  if ((code !== undefined && UNAUTHORIZED_CODES.has(code)) || status === 401)
    return new ProviderError("THREADS_UNAUTHORIZED", message, base);
  if ((code !== undefined && RATE_LIMIT_CODES.has(code)) || status === 429) {
    const retryAfterMs = parseRetryAfter(headers.get("retry-after"));
    return new ProviderError("THREADS_RATE_LIMITED", message, {
      ...base,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    });
  }
  // POC 2026-11-11: missing `threads_keyword_search` → code 10 (THApiException).
  if ((code !== undefined && (code === 10 || (code >= 200 && code <= 299))) || status === 403)
    return new ProviderError("THREADS_FORBIDDEN", message, base);
  if (status >= 500 || g.transient || (code !== undefined && TRANSIENT_CODES.has(code)))
    return new ProviderError("THREADS_UPSTREAM_ERROR", message, base);
  // Other 4xx (bad param): no contract code exists → UPSTREAM_ERROR but never retried (decision 2026-11-11, doc 06 §7).
  return new ProviderError("THREADS_UPSTREAM_ERROR", message, { ...base, retryable: false });
}

/** Timeout, abort and network failures share `THREADS_TIMEOUT` (doc 06 §2). */
export function networkError(error: unknown, aborted: boolean, timeoutMs: number, path: string): ProviderError {
  const timedOut = aborted || (error instanceof Error && error.name === "AbortError");
  return new ProviderError(
    "THREADS_TIMEOUT",
    timedOut ? `Threads request to ${path} timed out after ${timeoutMs} ms` : `Threads network error on ${path}`,
  );
}

/** 2xx with a body we cannot use. `details.sample` keeps the first 200 chars, redacted. */
export function malformed(path: string, status: number, bodyText: string, reason: string): ProviderError {
  return new ProviderError("THREADS_MALFORMED_RESPONSE", `Threads returned an unusable body on ${path}: ${reason}`, {
    providerStatus: status,
    details: { sample: redact(bodyText.slice(0, MAX_SAMPLE)) },
  });
}
