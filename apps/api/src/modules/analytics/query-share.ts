/**
 * Pure helper for the keyword (query) share endpoint (T-150) — docs/01-product/07-metric-definitions.md §4.
 */
import type { QueryShareResponse } from "@how-about-me/contracts";
import { share } from "./distributions";

export type QueryShareRow = { queryId: string; displayName: string; count: number };

/**
 * FR-145 / FR-147 — share = count / denominator (null when denominator = 0, FR-140). Shares are not normalised:
 * a post counts once per matched query, so they may sum to more than 1. Input order (SQL sort) is kept.
 */
export function toQueryShare(rows: readonly QueryShareRow[], denominator: number): QueryShareResponse {
  return {
    denominator,
    distribution: rows.map((r) => ({ ...r, share: share(r.count, denominator) })),
    note: "overlapping",
  };
}
