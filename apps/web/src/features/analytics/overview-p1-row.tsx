"use client";

import { queryDrillDown, segmentDrillDown } from "@/lib/filters/drill-down";
import { useIntentsDistribution, useLanguagesDistribution, useQueryShare } from "./api";
import { IntentDistributionChart, LanguageDistributionChart, QueryShareChart } from "./charts";
import { useQueryFilterOptions } from "./use-query-options";
import type { OverviewRowProps } from "./overview-row-props";
import { toQueryError } from "./query-error";

/** Last row (#336): intent, keyword share (T-150), language (T-148) — 4 columns each. */
export function OverviewP1Row({ projectId, apiParams, isProjectLoading, href, navigate }: OverviewRowProps) {
  const intents = useIntentsDistribution(projectId, apiParams);
  const languages = useLanguagesDistribution(projectId, apiParams);
  const queryShare = useQueryShare(projectId, apiParams);
  // Same cache entry as FilterBar → no extra request; gives tags their `#` (#329).
  const { names: queryNames } = useQueryFilterOptions();

  return (
    <>
      <IntentDistributionChart
        getHref={(k) => href(segmentDrillDown("intent", k))}
        onNavigate={navigate}
        className="lg:col-span-4"
        data={intents.data}
        isLoading={isProjectLoading || intents.isLoading}
        error={toQueryError(intents.error)}
        onRetry={() => void intents.refetch()}
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
      <LanguageDistributionChart
        getHref={(k) => href(segmentDrillDown("language", k))}
        onNavigate={navigate}
        className="lg:col-span-4"
        data={languages.data}
        isLoading={isProjectLoading || languages.isLoading}
        error={toQueryError(languages.error)}
        onRetry={() => void languages.refetch()}
      />
    </>
  );
}
