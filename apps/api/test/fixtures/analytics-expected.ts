/**
 * T-094 hand-checked expected numbers for the shared analytics fixture (`seedAnalyticsFixture`).
 * Source of truth for humans: docs/04-qa/02-analytics-qa-checklist.md "Fixture dataset & expected numbers".
 * Kept as `.ts` (not JSON) because apps/api does not enable `resolveJsonModule`.
 * Default filters: range 2026-10-05..2026-10-12 local (Asia/Ho_Chi_Minh), relevance=relevant (BR-016).
 */
export const ANALYTICS_EXPECTED = {
  overview: {
    mentionCount: 9, // P01–P07, P12, P16
    previous: 1, // P17
    growthPct: 800,
    growthState: "up",
    positive: { numerator: 3, denominator: 9 },
    negative: { numerator: 3, denominator: 9 },
    safetyRisk: { numerator: 2, denominator: 9, severeCount: 1 },
    complaint: { numerator: 4, denominator: 8 }, // denominator = relevant posts with ≥1 intent
    coverage: {
      relevantMentions: 9,
      analyzedMentions: 12, // completed effective analysis, any relevance: 9 relevant + P09, P10, P15
      pendingMentions: 1, // P13
      failedMentions: 1, // P14
      irrelevantMentions: 2, // P09, P10 (override)
      uncertainMentions: 1, // P15
    },
    metricsVersion: "metrics-v1",
  },
  // Day buckets 10-05..10-11 local; P05/P06 straddle local midnight (A15/A16).
  timeseriesDay: [3, 3, 1, 0, 1, 0, 1],
  // Same range bucketed with timezone=UTC: 10-04..10-11 UTC days.
  timeseriesDayUtc: [1, 2, 4, 0, 0, 1, 0, 1],
  sentiment: { positive: 3, neutral: 3, negative: 3 },
  safety: { safe: 7, sensitive: 1, severe: 1 },
  intents: { complaint: 4, praise: 3, question: 2 },
  intentsDenominator: 8,
  topics: { ticket: 4, payment: 2, venue: 2, artist: 1 },
  languages: { vi: 6, en: 2, other: 1 },
  queryShare: { q1: 6, q2: 4 }, // overlapping: 10 > 9 (A2)
  combos: { negativeTicket: 2 }, // P02, P12
  irrelevant: 2, // P09, P10
  // A9 scenario: override P04 sentiment negative → neutral.
  withP04Override: { negative: 2, neutral: 4 },
} as const;
