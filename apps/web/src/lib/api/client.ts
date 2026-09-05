import { ApiErrorEnvelopeSchema, type ErrorCode } from "@how-about-me/contracts";
import { env } from "@/lib/env";

/** Thrown for any non-2xx response; mirrors the API error envelope. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | "NETWORK_ERROR" | "UNKNOWN",
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenGetter = () => Promise<string | null> | string | null;
let getAccessToken: TokenGetter = () => null;
/** The auth feature (T-032) registers the Supabase session token getter here. */
export function setAccessTokenGetter(getter: TokenGetter) {
  getAccessToken = getter;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null | Array<string | number>>;

export function toSearchParams(params?: QueryParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { params?: QueryParams; retryOn401?: boolean } = {},
): Promise<T> {
  const { params, retryOn401 = true, headers, ...rest } = init;
  const token = await getAccessToken();
  const res = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}${path}${toSearchParams(params)}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  }).catch((e: unknown) => {
    throw new ApiError(0, "NETWORK_ERROR", e instanceof Error ? e.message : "Network error");
  });

  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) return body as T;

  const parsed = ApiErrorEnvelopeSchema.safeParse(body);
  const err = parsed.success
    ? new ApiError(
        res.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.requestId,
        parsed.data.error.details,
      )
    : new ApiError(res.status, "UNKNOWN", res.statusText);
  if (res.status === 401 && err.code === "AUTH_TOKEN_EXPIRED" && retryOn401 && onTokenExpired) {
    const refreshed = await onTokenExpired();
    if (refreshed) return apiFetch<T>(path, { ...init, retryOn401: false });
  }
  throw err;
}

let onTokenExpired: (() => Promise<boolean>) | null = null;
/** Registered by the auth feature: attempts one session refresh, returns true when a new token is available. */
export function setTokenExpiredHandler(handler: (() => Promise<boolean>) | null) {
  onTokenExpired = handler;
}
