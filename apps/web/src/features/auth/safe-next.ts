export const DEFAULT_AFTER_LOGIN = "/overview";

// Any origin works: we only check that `next` resolves to a same-origin path.
const PROBE_ORIGIN = "http://same-origin.invalid";

/**
 * Only same-origin absolute paths are allowed as post-login targets (prevents open redirect).
 * Parsing with `URL` catches inputs that browsers normalise to another host, e.g. `/\t/evil.com` → `//evil.com`.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return DEFAULT_AFTER_LOGIN;
  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_AFTER_LOGIN;
  if (url.pathname === "/login" || url.pathname.startsWith("/auth/")) return DEFAULT_AFTER_LOGIN;
  return `${url.pathname}${url.search}${url.hash}`;
}
