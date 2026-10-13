import type { OverviewResponse } from "@how-about-me/contracts";

const rate = (value: number | null, denominator: number, previous?: number | null) => ({
  value,
  numerator: value == null ? 0 : Math.round(value * denominator),
  denominator,
  ...(previous === undefined ? {} : { previous }),
});

export function overviewFixture(patch: Partial<OverviewResponse> = {}): OverviewResponse {
  return {
    meta: { metricsVersion: "v1", generatedAt: "2026-10-13T00:00:00.000Z" },
    range: { from: "2026-10-06T00:00:00.000Z", to: "2026-10-13T00:00:00.000Z", timezone: "Asia/Ho_Chi_Minh" },
    coverage: {
      relevantMentions: 2410,
      analyzedMentions: 2410,
      pendingMentions: 0,
      failedMentions: 0,
      irrelevantMentions: 0,
      uncertainMentions: 0,
    },
    dataQuality: {
      lastSyncStatus: "success",
      lastSyncAt: "2026-10-13T00:00:00.000Z",
      integrationStatus: "connected",
      collectorStatus: "healthy",
    },
    kpis: {
      mentionCount: { value: 2410, previous: 2000, growthPct: 0.205, growthState: "up" },
      positiveRate: rate(0.3, 2410),
      negativeRate: rate(0.2, 2410),
      safetyRiskRate: { ...rate(0.05, 2410), severeCount: 0 },
      complaintRate: rate(0.1, 2000),
    },
    ...patch,
  };
}
