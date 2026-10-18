/**
 * #331: filter keys shared by Overview, Mentions and the phrase page. The sidebar carries them
 * between those screens so the period and query scope do not reset; every other key resets.
 * Not a saved view (P2) — only the current URL is read.
 */
export const SHARED_FILTER_KEYS = ["preset", "from", "to", "tz", "queryIds", "relevance"] as const;

/** Keeps only the shared keys, verbatim (no re-parse). Returns "" or "?…". */
export function carryFilterQuery(search: URLSearchParams | null | undefined): string {
  if (!search) return "";
  const out = new URLSearchParams();
  for (const [k, v] of search) if ((SHARED_FILTER_KEYS as readonly string[]).includes(k)) out.append(k, v);
  const qs = out.toString();
  return qs ? `?${qs}` : "";
}
