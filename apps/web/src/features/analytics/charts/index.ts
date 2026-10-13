"use client";

import dynamic from "next/dynamic";
import { createElement } from "react";
import { ChartSkeleton } from "./chart-card";

/**
 * Lazy chart entry points (T-100): Recharts is heavy and client-only, so charts load after the KPI row.
 * `ssr: false` + a fixed-height skeleton keeps server and client markup identical (no hydration mismatch).
 */
const loading = () => createElement(ChartSkeleton);

export const MentionsOverTimeChart = dynamic(
  () => import("./mentions-over-time-chart").then((m) => m.MentionsOverTimeChart),
  { ssr: false, loading },
);
export const SentimentDistributionChart = dynamic(
  () => import("./sentiment-distribution-chart").then((m) => m.SentimentDistributionChart),
  { ssr: false, loading },
);
export const SentimentOverTimeChart = dynamic(
  () => import("./sentiment-over-time-chart").then((m) => m.SentimentOverTimeChart),
  { ssr: false, loading },
);
export const SafetyDistributionChart = dynamic(
  () => import("./safety-distribution-chart").then((m) => m.SafetyDistributionChart),
  { ssr: false, loading },
);
export const TopTopicsChart = dynamic(() => import("./top-topics-chart").then((m) => m.TopTopicsChart), {
  ssr: false,
  loading,
});
export const IntentDistributionChart = dynamic(
  () => import("./intent-distribution-chart").then((m) => m.IntentDistributionChart),
  { ssr: false, loading },
);
