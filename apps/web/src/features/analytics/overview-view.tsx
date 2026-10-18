"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useFilters } from "@/lib/filters/use-filters";
import { useTopicSentiment } from "./api";
import { FilterBar } from "./filter-bar";
import { OverviewKpiSection } from "./overview-kpi-section";
import { OverviewP1Row } from "./overview-p1-row";
import { OverviewTopicRows } from "./overview-topic-rows";
import { OverviewTrendRow } from "./overview-trend-row";
import { useOverviewDrillDown } from "./use-overview-drill-down";

/**
 * /overview body: filters → banners → KPI cards (T-099) → charts (T-100). Safety chart slot is T-101;
 * P1 row: language donut (T-148), keyword share (T-150), negative-topic contributors (T-149); topic × sentiment
 * heatmap (T-149) full width below. Sentiment bubble map (#222) full width above Top topics / Intent.
 * Bubble map, contributors and heatmap share one topic-sentiment request.
 * Each chart has its own query state so one failing chart never blanks the page.
 * Rows live in `overview-trend-row.tsx`, `overview-topic-rows.tsx`, `overview-p1-row.tsx` (#252); they render
 * Fragments so every chart stays a direct child of the 12-column grid.
 */
export function OverviewView() {
  const { project } = useCurrentProject();
  const { filters, apiParams } = useFilters("analytics");
  const { href, navigate, kpiHref, pendingHref } = useOverviewDrillDown(filters, apiParams);
  const topicSentiment = useTopicSentiment(project?.id, apiParams);
  const row = { projectId: project?.id, apiParams, isProjectLoading: !project, href, navigate };

  return (
    <div className="flex flex-col gap-6">
      <FilterBar showCompare queryOptions={[]} />
      <OverviewKpiSection
        projectId={project?.id}
        apiParams={apiParams}
        isProjectLoading={!project}
        kpiHref={kpiHref}
        pendingHref={pendingHref}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <OverviewTrendRow {...row} />
        <OverviewTopicRows {...row} topicSentiment={topicSentiment} />
        <OverviewP1Row {...row} topicSentiment={topicSentiment} />
      </div>
    </div>
  );
}
