import { RELEVANCE_LABELS } from "@how-about-me/taxonomy";

/**
 * `/mentions` pre-filtered to one listening query (FR-062). Shared by listening-queries and system-status so neither
 * feature imports the other. URL keys come from lib/filters/parsers.ts (`queryIds`, `preset`, `from`, `to`).
 */
export const mentionsHref = (queryId: string, preset?: "24h" | "30d") =>
  `/mentions?queryIds=${queryId}${preset ? `&preset=${preset}` : ""}`;

/** Mentions in a sync job window (#340 flows-6): custom range, ISO UTC bounds. */
export const mentionsWindowHref = (queryId: string, from: string, to: string) =>
  `/mentions?queryIds=${queryId}&preset=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

/**
 * Mentions for one query across every relevance label (#391). The listening-queries "Bài khớp mới" counts are ingest
 * counts that include uncertain/irrelevant posts, so the companion link widens the BR-016 default (`relevant` only).
 * Still `preset=30d` (no "all" preset), so the link carries no number.
 */
export const mentionsAllRelevanceHref = (queryId: string) =>
  `/mentions?queryIds=${queryId}&preset=30d&relevance=${RELEVANCE_LABELS.join(",")}`;
