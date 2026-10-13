"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { ApiError } from "@/lib/api/client";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { useFilters } from "@/lib/filters/use-filters";
import { QueryState } from "@/features/shared/query-state";
import {
  useIntentsDistribution,
  useMentionsTimeseries,
  useOverview,
  useSafetyDistribution,
  useSentiment,
  useTopicsDistribution,
} from "./api";
import {
  IntentDistributionChart,
  MentionsOverTimeChart,
  SafetyDistributionChart,
  SentimentDistributionChart,
  SentimentOverTimeChart,
  TopTopicsChart,
} from "./charts";
import { FilterBar } from "./filter-bar";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { OverviewBanners } from "./overview-banners";

function toQueryError(err: unknown) {
  if (!err) return null;
  return err instanceof ApiError
    ? { code: err.code, message: err.message, requestId: err.requestId }
    : { message: "Unexpected response from the server." };
}

/**
 * /overview body: filters → banners → KPI cards (T-099) → charts (T-100). Safety chart slot is T-101.
 * Each chart has its own query state so one failing chart never blanks the page.
 */
export function OverviewView() {
  const { project } = useCurrentProject();
  const { role } = useRole();
  const { apiParams } = useFilters("analytics");
  const query = useOverview(project?.id, apiParams);
  const error = toQueryError(query.error);
  const timeseries = useMentionsTimeseries(project?.id, apiParams);
  // One request feeds both the donut and the stacked bars.
  const sentiment = useSentiment(project?.id, apiParams);
  const safety = useSafetyDistribution(project?.id, apiParams);
  const topics = useTopicsDistribution(project?.id, apiParams);
  const intents = useIntentsDistribution(project?.id, apiParams);

  return (
    <div className="flex flex-col gap-6">
      <FilterBar showCompare queryOptions={[]} />
      {/* Users with no project never reach this view (RequireProject in the app shell); `project` is only null
          while /me loads and during SSR, so show the skeleton then — same markup on server and client. */}
      <QueryState
        isLoading={!project || query.isLoading}
        error={error}
        onRetry={() => void query.refetch()}
        skeleton={<KpiCardsSkeleton />}
      >
        {/* Zero mentions still renders cards (0 and "—"), never a blank page (BR-032). */}
        {query.data ? (
          <div className="flex flex-col gap-4">
            <OverviewBanners data={query.data} canManage={role === "admin"} />
            <KpiCards kpis={query.data.kpis} />
          </div>
        ) : null}
      </QueryState>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <MentionsOverTimeChart
          className="lg:col-span-8"
          data={timeseries.data}
          isLoading={!project || timeseries.isLoading}
          error={toQueryError(timeseries.error)}
          onRetry={() => void timeseries.refetch()}
        />
        <SentimentDistributionChart
          className="lg:col-span-4"
          data={sentiment.data}
          isLoading={!project || sentiment.isLoading}
          error={toQueryError(sentiment.error)}
          onRetry={() => void sentiment.refetch()}
        />
        <SentimentOverTimeChart
          className="lg:col-span-6"
          data={sentiment.data}
          timezone={apiParams.timezone ?? DEFAULT_TZ}
          isLoading={!project || sentiment.isLoading}
          error={toQueryError(sentiment.error)}
          onRetry={() => void sentiment.refetch()}
        />
        <SafetyDistributionChart
          className="lg:col-span-6"
          data={safety.data}
          isLoading={!project || safety.isLoading}
          error={toQueryError(safety.error)}
          onRetry={() => void safety.refetch()}
        />
        <TopTopicsChart
          className="lg:col-span-6"
          data={topics.data}
          isLoading={!project || topics.isLoading}
          error={toQueryError(topics.error)}
          onRetry={() => void topics.refetch()}
        />
        <IntentDistributionChart
          className="lg:col-span-6"
          data={intents.data}
          isLoading={!project || intents.isLoading}
          error={toQueryError(intents.error)}
          onRetry={() => void intents.refetch()}
        />
      </div>
    </div>
  );
}
