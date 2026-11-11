import { malformed, networkError, toThreadsError } from "./threads-error.mapper";

/**
 * One GET against the Threads Graph API = one HTTP request (retries live in `withRetry`, doc 06 §7).
 * The token travels only in `Authorization: Bearer` (BR-036, confirmed live 2026-11-11). Nothing is logged here,
 * and errors name the endpoint path only, never the URL (`/debug_token` must carry `input_token` in its query).
 */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export type ThreadsHttpOptions = {
  accessToken: string;
  baseUrl: string;
  timeoutMs: number;
  userAgent: string;
  fetchFn?: FetchFn;
  now?: () => number;
};

export type ThreadsJson = { body: unknown; headers: Headers; status: number; durationMs: number };

export async function getThreadsJson(
  path: string,
  params: Record<string, string | undefined>,
  opts: ThreadsHttpOptions,
): Promise<ThreadsJson> {
  const fetchFn = opts.fetchFn ?? ((u, init) => fetch(u, init));
  const now = opts.now ?? Date.now;
  const url = new URL(path.replace(/^\//, ""), opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);

  const controller = new AbortController();
  // The timer covers the body read too, so a slow-streaming body cannot hang a worker.
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const started = now();
  try {
    let res: Response;
    let text: string;
    try {
      res = await fetchFn(url.toString(), {
        method: "GET",
        headers: {
          authorization: `Bearer ${opts.accessToken}`,
          accept: "application/json",
          "user-agent": opts.userAgent,
        },
        signal: controller.signal,
      });
      text = await res.text();
    } catch (error) {
      throw networkError(error, controller.signal.aborted, opts.timeoutMs, path);
    }
    if (!res.ok) throw toThreadsError(res.status, text, res.headers, path);
    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw malformed(path, res.status, text, "invalid JSON");
    }
    return { body, headers: res.headers, status: res.status, durationMs: Math.max(0, now() - started) };
  } finally {
    clearTimeout(timer);
  }
}
