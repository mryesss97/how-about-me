"use client";

import { queryDrillDown, segmentDrillDown, topicSentimentDrillDown } from "@/lib/filters/drill-down";
import { useLanguagesDistribution, useQueryShare } from "./api";
import { LanguageDistributionChart, NegativeTopicsChart, QueryShareChart, TopicSentimentHeatmap } from "./charts";
import { useQueryFilterOptions } from "./use-query-options";
import type { OverviewRowProps, TopicSentimentQuery } from "./overview-row-props";
import { toQueryError } from "./query-error";

type Props = OverviewRowProps & { topicSentiment: TopicSentimentQuery };

/** P1 row: language (T-148), keyword share (T-150), negative-topic contributors (T-149); heatmap full width. */
export function OverviewP1Row({ projectId, apiParams, isProjectLoading, href, navigate, topicSentiment }: Props) {
  const languages = useLanguagesDistribution(projectId, apiParams);
  const queryShare = useQueryShare(projectId, apiParams);
  // Same cache entry as FilterBar → no extra request; gives tags their `#` (#329).
  const { names: queryNames } = useQueryFilterOptions();

  return (
    <>
      <LanguageDistributionChart
        getHref={(k) => href(segmentDrillDown("language", k))}
        onNavigate={navigate}
        className="lg:col-span-4"
        data={languages.data}
        isLoading={isProjectLoading || languages.isLoading}
        error={toQueryError(languages.error)}
        onRetry={() => void languages.refetch()}
      />
      <QueryShareChart
        getHref={(id) => href(queryDrillDown(id))}
        onNavigate={navigate}
        className="lg:col-span-4"
        data={queryShare.data}
        queryNames={queryNames}
        isLoading={isProjectLoading || queryShare.isLoading}
        error={toQueryError(queryShare.error)}
        onRetry={() => void queryShare.refetch()}
      />
      <NegativeTopicsChart
        getHref={(t) => href(topicSentimentDrillDown(t, "negative"))}
        onNavigate={navigate}
        className="lg:col-span-4"
        data={topicSentiment.data}
        isLoading={isProjectLoading || topicSentiment.isLoading}
        error={toQueryError(topicSentiment.error)}
        onRetry={() => void topicSentiment.refetch()}
      />
      <TopicSentimentHeatmap
        getCellHref={(t, s) => href(topicSentimentDrillDown(t, s ?? undefined))}
        className="lg:col-span-12"
        data={topicSentiment.data}
        isLoading={isProjectLoading || topicSentiment.isLoading}
        error={toQueryError(topicSentiment.error)}
        onRetry={() => void topicSentiment.refetch()}
      />
    </>
  );
}
