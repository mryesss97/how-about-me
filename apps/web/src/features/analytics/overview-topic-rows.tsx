"use client";

import type { TopicLabel } from "@how-about-me/taxonomy";
import { useState } from "react";
import { phraseSentimentDrillDown, segmentDrillDown, topicSentimentDrillDown } from "@/lib/filters/drill-down";
import { useIntentsDistribution, usePhraseSentiment, useTopicsDistribution } from "./api";
import { IntentDistributionChart, SentimentBubbleMap, TopTopicsChart } from "./charts";
import type { BubbleMode } from "./charts/bubble-mode";
import type { OverviewRowProps, TopicSentimentQuery } from "./overview-row-props";
import { toQueryError } from "./query-error";

type Props = OverviewRowProps & { topicSentiment: TopicSentimentQuery };

/** Sentiment bubble map (#222) full width, then Top topics / Intent. */
export function OverviewTopicRows({ projectId, apiParams, isProjectLoading, href, navigate, topicSentiment }: Props) {
  const topics = useTopicsDistribution(projectId, apiParams);
  const intents = useIntentsDistribution(projectId, apiParams);
  // #243: Topics | Phrases toggle is local state; the phrases request only runs in Phrases mode.
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>("topics");
  const phrases = usePhraseSentiment(projectId, apiParams, { enabled: bubbleMode === "phrases" });
  const bubbleQuery = bubbleMode === "phrases" ? phrases : topicSentiment;

  return (
    <>
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
        isLoading={isProjectLoading || bubbleQuery.isLoading}
        error={toQueryError(bubbleQuery.error)}
        onRetry={() => void bubbleQuery.refetch()}
      />
      <TopTopicsChart
        getHref={(k) => href(segmentDrillDown("topic", k))}
        onNavigate={navigate}
        className="lg:col-span-6"
        data={topics.data}
        isLoading={isProjectLoading || topics.isLoading}
        error={toQueryError(topics.error)}
        onRetry={() => void topics.refetch()}
      />
      <IntentDistributionChart
        getHref={(k) => href(segmentDrillDown("intent", k))}
        onNavigate={navigate}
        className="lg:col-span-6"
        data={intents.data}
        isLoading={isProjectLoading || intents.isLoading}
        error={toQueryError(intents.error)}
        onRetry={() => void intents.refetch()}
      />
    </>
  );
}
