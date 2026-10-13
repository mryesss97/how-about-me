import type {
  IntentsDistributionResponse,
  OverviewResponse,
  SafetyDistributionResponse,
  SentimentResponse,
  TimeseriesResponse,
  TopicsDistributionResponse,
} from "@how-about-me/contracts";
import { INTENT_LABELS, TOPIC_LABELS } from "@how-about-me/taxonomy";

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
      mentionCount: { value: 2410, previous: 2000, growthPct: 20.5, growthState: "up" },
      positiveRate: rate(0.3, 2410),
      negativeRate: rate(0.2, 2410),
      safetyRiskRate: { ...rate(0.05, 2410), severeCount: 0 },
      complaintRate: rate(0.1, 2000),
    },
    ...patch,
  };
}

/** 7 daily buckets, zero-filled (TC-DASH-012); pass `withPrevious` for compare (TC-DASH-017). */
export function timeseriesFixture(withPrevious = false): TimeseriesResponse {
  const counts = [5, 0, 0, 12, 0, 3, 0];
  return {
    interval: "day",
    timezone: "Asia/Ho_Chi_Minh",
    data: counts.map((mentions, i) => ({
      time: new Date(Date.UTC(2026, 9, 5, 17) + i * 86_400_000).toISOString(),
      mentions,
      ...(withPrevious ? { previous: i } : {}),
    })),
  };
}

export function sentimentFixture(patch: Partial<SentimentResponse> = {}): SentimentResponse {
  return {
    denominator: 100,
    distribution: [
      { label: "positive", count: 30, share: 0.3 },
      { label: "neutral", count: 50, share: 0.5 },
      { label: "negative", count: 20, share: 0.2 },
    ],
    timeseries: {
      interval: "day",
      data: [
        { time: "2026-10-05T17:00:00.000Z", positive: 10, neutral: 20, negative: 5 },
        { time: "2026-10-06T17:00:00.000Z", positive: 20, neutral: 30, negative: 15 },
      ],
    },
    ...patch,
  };
}

export function safetyFixture(patch: Partial<SafetyDistributionResponse> = {}): SafetyDistributionResponse {
  return {
    denominator: 200,
    distribution: [
      { label: "safe", count: 170, share: 0.85 },
      { label: "sensitive", count: 24, share: 0.12 },
      { label: "severe", count: 6, share: 0.03 },
    ],
    ...patch,
  };
}

/** 12 topics + "other" (deliberately not last in input); shares sum > 100 % (multi-label). */
export function topicsFixture(): TopicsDistributionResponse {
  const named = TOPIC_LABELS.filter((t) => t !== "other");
  return {
    denominator: 100,
    distribution: [
      { label: "other", count: 5, share: 0.05 },
      ...named.map((label, i) => ({ label, count: 40 - i, share: (40 - i) / 100 })),
    ],
  };
}

/** All 11 intents, some with count 0; shares sum > 100 %. */
export function intentsFixture(): IntentsDistributionResponse {
  return {
    denominator: 50,
    distribution: INTENT_LABELS.map((label, i) => {
      const count = i < 4 ? 30 - i * 5 : 0;
      return { label, count, share: count / 50 };
    }),
  };
}
