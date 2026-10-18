import type { IntegrationStatus } from "@how-about-me/contracts";

/** FR-046: "Sắp hết hạn" when the Threads token expires within this many days. */
export const TOKEN_WARN_DAYS = 7;
const DAY_MS = 86_400_000;

/** Whole days until the token expires (ceil, by elapsed ms, not calendar days); ≤ 0 = expired; null = unknown. */
export function tokenDaysLeft(expiresAt: string | null, nowMs: number): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - nowMs) / DAY_MS);
}

export type TokenExpiryState = "ok" | "soon" | "expired" | "unknown";

/**
 * FR-046 / BR-017: expiry state of a connected token. Only `connected` is judged — other statuses already say
 * what is wrong. Settings uses the browser clock and System Status `generatedAt`, so the two may differ by a
 * day at the boundary; accepted.
 */
export function tokenExpiryState(status: IntegrationStatus, expiresAt: string | null, nowMs: number): TokenExpiryState {
  const days = tokenDaysLeft(expiresAt, nowMs);
  if (status !== "connected" || days == null) return "unknown";
  if (days <= 0) return "expired";
  if (days <= TOKEN_WARN_DAYS) return "soon";
  return "ok";
}
