/**
 * `/mentions` pre-filtered to one listening query (FR-062). Shared by listening-queries and system-status so neither
 * feature imports the other. URL keys come from lib/filters/parsers.ts (`queryIds`, `preset`, `from`, `to`).
 */
export const mentionsHref = (queryId: string, preset?: "24h" | "30d") =>
  `/mentions?queryIds=${queryId}${preset ? `&preset=${preset}` : ""}`;

/** Mentions in a sync job window (#340 flows-6): custom range, ISO UTC bounds. */
export const mentionsWindowHref = (queryId: string, from: string, to: string) =>
  `/mentions?queryIds=${queryId}&preset=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
