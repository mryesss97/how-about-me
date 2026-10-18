"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { OverviewBanners } from "@/features/shared/overview-banners";
import { useFilters } from "@/lib/filters/use-filters";
import { useOverview, useTopicSentiment } from "./api";
import { FilterBar } from "./filter-bar";
import { OverviewKpiSection } from "./overview-kpi-section";
import { OverviewP1Row } from "./overview-p1-row";
import { OverviewTopicRows } from "./overview-topic-rows";
import { OverviewTrendRow } from "./overview-trend-row";
import { useOverviewDrillDown } from "./use-overview-drill-down";

/**
 * /overview body (#336, UX §3.2): banners (directly under the fascia) → filters → KPI cards (T-099) → charts:
 * Mentions over time 8 + Sentiment donut 4; Sentiment over time 8 + Safety 4 (same width so the date ticks line up);
 * Negative topics 6 + Top topics 6; Sentiment map 12 (its "Bảng" view carries the topic × sentiment cells);
 * Intent 4 + Keyword share 4 + Language 4. Bubble map and negative topics share one topic-sentiment request; banners,
 * KPI and the fascia freshness line share one overview request (same query key).
 * Each chart has its own query state so one failing chart never blanks the page.
 * Rows live in `overview-trend-row.tsx`, `overview-topic-rows.tsx`, `overview-p1-row.tsx` (#252); they render
 * Fragments so every chart stays a direct child of the 12-column grid.
 */
export function OverviewView() {
  const { project } = useCurrentProject();
  const { filters, apiParams } = useFilters("analytics");
  const { href, navigate, kpiHref, pendingHref } = useOverviewDrillDown(filters, apiParams);
  const topicSentiment = useTopicSentiment(project?.id, apiParams);
  const { role } = useRole();
  // Same key as the KPI section → TanStack dedupes, no extra request. Banners need `dataQuality`, so they still
  // hide while the overview is loading or failed (the KPI section shows the error + Retry then).
  const overview = useOverview(project?.id, apiParams);
  const row = { projectId: project?.id, apiParams, isProjectLoading: !project, href, navigate };

  return (
    <div className="flex flex-col gap-6">
      {overview.data ? (
        // FR-015: canManage is UX only; the API enforces roles.
        <OverviewBanners data={overview.data} canManage={role === "admin"} pendingHref={pendingHref} />
      ) : null}
      <FilterBar showCompare shareLink />
      <OverviewKpiSection
        projectId={project?.id}
        apiParams={apiParams}
        isProjectLoading={!project}
        kpiHref={kpiHref}
        filters={filters}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <OverviewTrendRow {...row} />
        <OverviewTopicRows {...row} topicSentiment={topicSentiment} />
        <OverviewP1Row {...row} />
      </div>
    </div>
  );
}
