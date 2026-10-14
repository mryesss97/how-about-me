import type { OverviewResponse } from "@how-about-me/contracts";

const rate = (value: number | null) => ({ value, numerator: 0, denominator: 0 });
export const overviewFixture = (
  over: Partial<{
    growthPct: number | null;
    growthState: "up" | "down" | "flat" | "new";
    lastSyncAt: string | null;
  }> = {},
): OverviewResponse => ({
  meta: { metricsVersion: "1", generatedAt: "2026-10-14T05:00:00Z" },
  range: { from: "2026-09-14T05:00:00Z", to: "2026-10-14T05:00:00Z", timezone: "Asia/Ho_Chi_Minh" },
  coverage: {
    relevantMentions: 0,
    analyzedMentions: 0,
    pendingMentions: 0,
    failedMentions: 0,
    irrelevantMentions: 0,
    uncertainMentions: 0,
  },
  dataQuality: {
    lastSyncStatus: "success",
    lastSyncAt: "lastSyncAt" in over ? (over.lastSyncAt ?? null) : "2026-10-14T04:30:00Z",
    integrationStatus: "connected",
    collectorStatus: "healthy",
  },
  kpis: {
    mentionCount: {
      value: 1284,
      previous: 1000,
      growthPct: "growthPct" in over ? (over.growthPct ?? null) : 12,
      growthState: over.growthState ?? "up",
    },
    positiveRate: rate(0.62),
    negativeRate: rate(0.1),
    safetyRiskRate: { ...rate(0.05), severeCount: 1 },
    complaintRate: rate(0.2),
  },
});
