"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { ApiError } from "@/lib/api/client";
import { useFilters } from "@/lib/filters/use-filters";
import { QueryState } from "@/features/shared/query-state";
import { useOverview } from "./api";
import { FilterBar } from "./filter-bar";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { OverviewBanners } from "./overview-banners";

/** /overview body: filters → banners → KPI cards (T-099). Charts come with T-100/T-101. */
export function OverviewView() {
  const { project } = useCurrentProject();
  const { role } = useRole();
  const { apiParams } = useFilters("analytics");
  const query = useOverview(project?.id, apiParams);
  const err = query.error;
  const error = err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Unexpected response from the server." }
    : null;

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
    </div>
  );
}
