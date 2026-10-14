"use client";

import type { TopicLabel } from "@how-about-me/taxonomy";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { ApiError } from "@/lib/api/client";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { toMentionsHref } from "@/lib/filters/api-params";
import {
  bucketDrillDown,
  type DrillKpiId,
  kpiDrillDown,
  queryDrillDown,
  segmentDrillDown,
  phraseSentimentDrillDown,
  topicSentimentDrillDown,
} from "@/lib/filters/drill-down";
import type { Filters } from "@/lib/filters/schema";
import { useFilters } from "@/lib/filters/use-filters";
import { QueryState } from "@/features/shared/query-state";
import {
  useIntentsDistribution,
  useLanguagesDistribution,
  useMentionsTimeseries,
  useOverview,
  useSafetyDistribution,
  useQueryShare,
  useSentiment,
  usePhraseSentiment,
  useTopicSentiment,
  useTopicsDistribution,
} from "./api";
import {
  IntentDistributionChart,
  LanguageDistributionChart,
  MentionsOverTimeChart,
  NegativeTopicsChart,
  QueryShareChart,
  SafetyDistributionChart,
  SentimentDistributionChart,
  SentimentOverTimeChart,
  TopTopicsChart,
  SentimentBubbleMap,
  TopicSentimentHeatmap,
} from "./charts";
import type { BubbleMode } from "./charts/bubble-mode";
import { FilterBar } from "./filter-bar";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { OverviewBanners } from "@/features/shared/overview-banners";

function toQueryError(err: unknown) {
  if (!err) return null;
  return err instanceof ApiError
    ? { code: err.code, message: err.message, requestId: err.requestId }
    : { message: "Unexpected response from the server." };
}

/**
 * /overview body: filters → banners → KPI cards (T-099) → charts (T-100). Safety chart slot is T-101;
 * P1 row: language donut (T-148), keyword share (T-150), negative-topic contributors (T-149); topic × sentiment
 * heatmap (T-149) full width below. Sentiment bubble map (#222) full width above Top topics / Intent.
 * Bubble map, contributors and heatmap share one topic-sentiment request.
 * Each chart has its own query state so one failing chart never blanks the page.
 */
export function OverviewView() {
  const { project } = useCurrentProject();
  const { role } = useRole();
  const { filters, apiParams } = useFilters("analytics");
  const router = useRouter();
  const query = useOverview(project?.id, apiParams);
  const error = toQueryError(query.error);
  const timeseries = useMentionsTimeseries(project?.id, apiParams);
  // One request feeds both the donut and the stacked bars.
  const sentiment = useSentiment(project?.id, apiParams);
  const safety = useSafetyDistribution(project?.id, apiParams);
  const topics = useTopicsDistribution(project?.id, apiParams);
  const intents = useIntentsDistribution(project?.id, apiParams);
  const languages = useLanguagesDistribution(project?.id, apiParams);
  const queryShare = useQueryShare(project?.id, apiParams);
  const topicSentiment = useTopicSentiment(project?.id, apiParams);
  // #243: Topics | Phrases toggle is local state; the phrases request only runs in Phrases mode.
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>("topics");
  const phrases = usePhraseSentiment(project?.id, apiParams, { enabled: bubbleMode === "phrases" });
  const bubbleQuery = bubbleMode === "phrases" ? phrases : topicSentiment;

  // FR-142 drill-down: pin the exact range sent to analytics (not a fresh "now"), so the list matches the counts.
  const queriedTo = apiParams.to;
  const href = useCallback(
    (extra: Partial<Filters> | null) =>
      extra ? toMentionsHref(filters, extra, new Date(queriedTo ?? Date.now())) : null,
    [filters, queriedTo],
  );
  const navigate = useCallback((to: string) => router.push(to), [router]);
  const kpiHref = useCallback((id: DrillKpiId) => href(kpiDrillDown(id)) ?? "/mentions", [href]);
  const bucketTimes = useMemo(() => timeseries.data?.data.map((p) => p.time) ?? [], [timeseries.data]);
  const bucketHref = useCallback(
    (i: number) =>
      apiParams.from && apiParams.to
        ? href(bucketDrillDown(bucketTimes, i, { from: apiParams.from, to: apiParams.to }))
        : null,
    [href, bucketTimes, apiParams.from, apiParams.to],
  );

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
            <KpiCards kpis={query.data.kpis} hrefFor={kpiHref} />
          </div>
        ) : null}
      </QueryState>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <MentionsOverTimeChart
          getBucketHref={bucketHref}
          onNavigate={navigate}
          className="lg:col-span-8"
          data={timeseries.data}
          isLoading={!project || timeseries.isLoading}
          error={toQueryError(timeseries.error)}
          onRetry={() => void timeseries.refetch()}
        />
        <SentimentDistributionChart
          getHref={(k) => href(segmentDrillDown("sentiment", k))}
          onNavigate={navigate}
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
          getHref={(k) => href(segmentDrillDown("safety", k))}
          onNavigate={navigate}
          className="lg:col-span-6"
          data={safety.data}
          isLoading={!project || safety.isLoading}
          error={toQueryError(safety.error)}
          onRetry={() => void safety.refetch()}
        />
        <SentimentBubbleMap
          getHref={(k, s) =>
            href(
              bubbleMode === "phrases"
                ? phraseSentimentDrillDown(k, s ?? undefined)
                : topicSentimentDrillDown(k as TopicLabel, s ?? undefined),
            )
          }
          mode={bubbleMode}
          onModeChange={setBubbleMode}
          className="lg:col-span-12"
          data={topicSentiment.data}
          phraseData={phrases.data}
          isLoading={!project || bubbleQuery.isLoading}
          error={toQueryError(bubbleQuery.error)}
          onRetry={() => void bubbleQuery.refetch()}
        />
        <TopTopicsChart
          getHref={(k) => href(segmentDrillDown("topic", k))}
          onNavigate={navigate}
          className="lg:col-span-6"
          data={topics.data}
          isLoading={!project || topics.isLoading}
          error={toQueryError(topics.error)}
          onRetry={() => void topics.refetch()}
        />
        <IntentDistributionChart
          getHref={(k) => href(segmentDrillDown("intent", k))}
          onNavigate={navigate}
          className="lg:col-span-6"
          data={intents.data}
          isLoading={!project || intents.isLoading}
          error={toQueryError(intents.error)}
          onRetry={() => void intents.refetch()}
        />
        <LanguageDistributionChart
          getHref={(k) => href(segmentDrillDown("language", k))}
          onNavigate={navigate}
          className="lg:col-span-4"
          data={languages.data}
          isLoading={!project || languages.isLoading}
          error={toQueryError(languages.error)}
          onRetry={() => void languages.refetch()}
        />
        <QueryShareChart
          getHref={(id) => href(queryDrillDown(id))}
          onNavigate={navigate}
          className="lg:col-span-4"
          data={queryShare.data}
          isLoading={!project || queryShare.isLoading}
          error={toQueryError(queryShare.error)}
          onRetry={() => void queryShare.refetch()}
        />
        <NegativeTopicsChart
          getHref={(t) => href(topicSentimentDrillDown(t, "negative"))}
          onNavigate={navigate}
          className="lg:col-span-4"
          data={topicSentiment.data}
          isLoading={!project || topicSentiment.isLoading}
          error={toQueryError(topicSentiment.error)}
          onRetry={() => void topicSentiment.refetch()}
        />
        <TopicSentimentHeatmap
          getCellHref={(t, s) => href(topicSentimentDrillDown(t, s ?? undefined))}
          className="lg:col-span-12"
          data={topicSentiment.data}
          isLoading={!project || topicSentiment.isLoading}
          error={toQueryError(topicSentiment.error)}
          onRetry={() => void topicSentiment.refetch()}
        />
      </div>
    </div>
  );
}
