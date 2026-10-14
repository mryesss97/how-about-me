import type { useTopicSentiment } from "./api";
import type { DrillHref, OverviewApiParams } from "./use-overview-drill-down";

/** Shared props of the /overview chart rows; each row renders a Fragment inside the 12-column grid. */
export type OverviewRowProps = {
  projectId?: string;
  apiParams: OverviewApiParams;
  isProjectLoading: boolean;
  href: DrillHref;
  navigate: (to: string) => void;
};

export type TopicSentimentQuery = ReturnType<typeof useTopicSentiment>;
