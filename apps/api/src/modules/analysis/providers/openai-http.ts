import { parseRetryAfter, ProviderError } from "../../../common/errors/provider.error";

/**
 * Thin OpenAI HTTP helper shared by the moderation (T-071) and classifier (T-072) adapters —
 * docs/02-architecture/07-analysis-pipeline.md §6/§8.
 *
 * One call = one HTTP request: the retry loop belongs to `withRetry` in the adapter, which in turn
 * complements (never replaces) the job-level backoff of T-075. Never logs or embeds the API key or the
 * request body in errors; from provider error bodies only `error.type`/`error.code` are kept.
 */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type OpenAiHttpOptions = {
  apiKey: string;
  timeoutMs: number;
  fetchFn?: FetchFn;
};

const MAX_ERROR_BODY = 500;

export async function postOpenAiJson(url: string, body: unknown, opts: OpenAiHttpOptions): Promise<unknown> {
  const fetchFn = opts.fetchFn ?? ((u, init) => fetch(u, init));
  const controller = new AbortController();
  // The timer covers the whole exchange, body read included, so a slow-streaming body cannot hang a worker.
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw networkError(error, controller, opts.timeoutMs);
    }

    const providerRequestId = res.headers.get("x-request-id") ?? undefined;
    if (!res.ok) throw await toProviderError(res, providerRequestId);

    try {
      return (await res.json()) as unknown;
    } catch (error) {
      if (controller.signal.aborted) throw networkError(error, controller, opts.timeoutMs);
      throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "OpenAI returned invalid JSON", {
        providerStatus: res.status,
        ...(providerRequestId ? { subcode: providerRequestId } : {}),
      });
    }
  } finally {
    clearTimeout(timer);
  }
}

function networkError(error: unknown, controller: AbortController, timeoutMs: number): ProviderError {
  const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
  return new ProviderError(
    "ANALYSIS_PROVIDER_ERROR",
    timedOut ? `OpenAI request timed out after ${timeoutMs} ms` : "OpenAI network error",
  );
}

/**
 * Only the allow-listed `error.type` / `error.code` of OpenAI's error body reach the message — never its free-text
 * `message`, which can quote the rejected input (post text) on a 400 (docs/02-architecture/08-security-secrets.md §5).
 */
async function summariseErrorBody(res: Response): Promise<string> {
  const text = (await res.text().catch(() => "")).slice(0, MAX_ERROR_BODY);
  try {
    const parsed = JSON.parse(text) as { error?: { type?: unknown; code?: unknown } } | null;
    const parts = [parsed?.error?.type, parsed?.error?.code].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    return parts.map((v) => v.slice(0, 100)).join("/");
  } catch {
    return "";
  }
}

async function toProviderError(res: Response, providerRequestId: string | undefined): Promise<ProviderError> {
  const summary = await summariseErrorBody(res);
  const base = { providerStatus: res.status, ...(providerRequestId ? { subcode: providerRequestId } : {}) };
  const message = `OpenAI HTTP ${res.status}${summary ? `: ${summary}` : ""}`;
  if (res.status === 401 || res.status === 403) return new ProviderError("ANALYSIS_PROVIDER_AUTH", message, base);
  if (res.status === 429 || res.status >= 500) {
    const retryAfterMs = res.status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : undefined;
    return new ProviderError("ANALYSIS_PROVIDER_ERROR", message, {
      ...base,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    });
  }
  return new ProviderError("ANALYSIS_PROVIDER_BAD_REQUEST", message, base);
}
