import { ApiError } from "@/lib/api/client";

/** 400 VALIDATION_ERROR whose details point at `cursor` (`{ path }` or `{ issues: [{ path }] }`). */
export function isRejectedCursor(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 400 || err.code !== "VALIDATION_ERROR") return false;
  const d = err.details as { path?: unknown; issues?: { path?: unknown }[] } | undefined;
  return d?.path === "cursor" || (Array.isArray(d?.issues) && d.issues.some((i) => i?.path === "cursor"));
}

/** Rows can shift into the next page when new data lands between requests — keep the first occurrence (TC-MEN-003). */
export function flattenUnique<P extends { items: readonly { id: string }[] }>(
  pages: readonly P[],
): P["items"][number][] {
  const seen = new Set<string>();
  const out: P["items"][number][] = [];
  for (const page of pages)
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  return out;
}
