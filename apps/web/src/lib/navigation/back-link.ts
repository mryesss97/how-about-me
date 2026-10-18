/**
 * #331: full-page mention detail returns to where the user came from via `?back=<internal path>`.
 * Stable across refresh / new tab (unlike history.back). Not a filter key; never sent to the API.
 */
export const BACK_PARAM = "back";

const ALLOWED_PREFIXES = ["/terms/", "/system-status", "/reviews", "/mentions"];

export function withBack(href: string, backPath: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${BACK_PARAM}=${encodeURIComponent(backPath)}`;
}

export interface BackLink {
  href: string;
  label: string;
}

/** Validates `back` (internal, whitelisted paths only — blocks open redirect) and labels it by source. */
export function resolveBack(raw: string | null | undefined): BackLink | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  const ok = ALLOWED_PREFIXES.some((p) =>
    p.endsWith("/") ? path.startsWith(p) && path.length > p.length : path === p || path.startsWith(`${p}/`),
  );
  if (!ok) return null;
  if (path.startsWith("/terms/")) {
    let term = path.slice("/terms/".length);
    try {
      term = decodeURIComponent(term);
    } catch {
      // keep raw segment
    }
    return { href: raw, label: `Về cụm từ "${term}"` };
  }
  if (path.startsWith("/system-status")) return { href: raw, label: "Về Lỗi phân tích" };
  if (path.startsWith("/reviews")) return { href: raw, label: "Về Cần xem lại" };
  return { href: raw, label: "Quay lại danh sách" };
}
