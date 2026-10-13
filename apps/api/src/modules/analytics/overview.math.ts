/** Pure overview helpers — docs/01-product/07-metric-definitions.md §1, §2 (FR-132, FR-133). */
export type RateValue = { value: number | null; numerator: number; denominator: number };
export type GrowthState = "up" | "down" | "flat" | "new";
export type CollectorStatus = "healthy" | "degraded" | "paused";

/** FR-132 / A12: zero denominator → null, never 0. */
export function rate(numerator: number, denominator: number): RateValue {
  return { value: denominator === 0 ? null : numerator / denominator, numerator, denominator };
}

/** FR-133 / A11: previous = 0 → "new"; |g| < 0.5% → "flat"; growthPct is a percentage rounded to 1 decimal. */
export function growth(current: number, previous: number): { growthPct: number | null; growthState: GrowthState } {
  if (previous === 0) return { growthPct: null, growthState: "new" };
  const g = (current - previous) / previous;
  const growthPct = Math.round(g * 1000) / 10;
  if (Math.abs(g) < 0.005) return { growthPct, growthState: "flat" };
  return { growthPct, growthState: g > 0 ? "up" : "down" };
}

/** metric-definitions §2: paused when the circuit is open; degraded on failed/partial sync or non-connected Threads. */
export function collectorStatus(input: {
  circuitOpenUntil: Date | null;
  lastSyncStatus: string;
  integrationStatus: string;
  now: Date;
}): CollectorStatus {
  if (input.circuitOpenUntil && input.circuitOpenUntil.getTime() > input.now.getTime()) return "paused";
  if (input.lastSyncStatus === "failed" || input.lastSyncStatus === "partial") return "degraded";
  if (input.integrationStatus !== "connected") return "degraded";
  return "healthy";
}

/** Recent-sync window: 2 × the longest poll interval of enabled queries (default 600 s). */
export function lastSyncWindowMs(maxPollSeconds: number | null): number {
  return 2 * (maxPollSeconds ?? 600) * 1000;
}
