"use client";

import type { SentimentLabel } from "@how-about-me/taxonomy";
import { useCallback, useMemo } from "react";
import { bucketDrillDown, bucketSentimentDrillDown, segmentDrillDown } from "@/lib/filters/drill-down";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { useMentionsTimeseries, useSafetyDistribution, useSentiment } from "./api";
import {
  MentionsOverTimeChart,
  SafetyDistributionChart,
  SentimentDistributionChart,
  SentimentOverTimeChart,
} from "./charts";
import type { OverviewRowProps } from "./overview-row-props";
import { toQueryError } from "./query-error";

/** Mentions over time, sentiment donut + stacked bars, safety (T-100/T-101). */
export function OverviewTrendRow({ projectId, apiParams, isProjectLoading, href, navigate }: OverviewRowProps) {
  const timeseries = useMentionsTimeseries(projectId, apiParams);
  // One request feeds both the donut and the stacked bars.
  const sentiment = useSentiment(projectId, apiParams);
  const safety = useSafetyDistribution(projectId, apiParams);
  const bucketTimes = useMemo(() => timeseries.data?.data.map((p) => p.time) ?? [], [timeseries.data]);
  const bucketHref = useCallback(
    (i: number) =>
      apiParams.from && apiParams.to
        ? href(bucketDrillDown(bucketTimes, i, { from: apiParams.from, to: apiParams.to }))
        : null,
    [href, bucketTimes, apiParams.from, apiParams.to],
  );
  // Index into the sentiment series' own buckets, not the mentions series (lengths can differ, #335).
  const sentimentTimes = useMemo(() => sentiment.data?.timeseries?.data.map((p) => p.time) ?? [], [sentiment.data]);
  const sentimentHref = useCallback(
    (i: number, k: SentimentLabel | null) =>
      apiParams.from && apiParams.to
        ? href(bucketSentimentDrillDown(sentimentTimes, i, { from: apiParams.from, to: apiParams.to }, k))
        : null,
    [href, sentimentTimes, apiParams.from, apiParams.to],
  );

  return (
    <>
      <MentionsOverTimeChart
        getBucketHref={bucketHref}
        onNavigate={navigate}
        className="lg:col-span-8"
        data={timeseries.data}
        isLoading={isProjectLoading || timeseries.isLoading}
        error={toQueryError(timeseries.error)}
        onRetry={() => void timeseries.refetch()}
      />
      <SentimentDistributionChart
        getHref={(k) => href(segmentDrillDown("sentiment", k))}
        onNavigate={navigate}
        className="lg:col-span-4"
        data={sentiment.data}
        isLoading={isProjectLoading || sentiment.isLoading}
        error={toQueryError(sentiment.error)}
        onRetry={() => void sentiment.refetch()}
      />
      <SentimentOverTimeChart
        getSegmentHref={sentimentHref}
        onNavigate={navigate}
        className="lg:col-span-6"
        data={sentiment.data}
        timezone={apiParams.timezone ?? DEFAULT_TZ}
        isLoading={isProjectLoading || sentiment.isLoading}
        error={toQueryError(sentiment.error)}
        onRetry={() => void sentiment.refetch()}
      />
      <SafetyDistributionChart
        getHref={(k) => href(segmentDrillDown("safety", k))}
        onNavigate={navigate}
        className="lg:col-span-6"
        data={safety.data}
        isLoading={isProjectLoading || safety.isLoading}
        error={toQueryError(safety.error)}
        onRetry={() => void safety.refetch()}
      />
    </>
  );
}
