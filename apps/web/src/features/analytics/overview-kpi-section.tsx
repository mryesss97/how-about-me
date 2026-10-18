"use client";

import type { DrillKpiId } from "@/lib/filters/drill-down";
import type { Filters } from "@/lib/filters/schema";
import { useRole } from "@/features/auth/use-role";
import { OverviewBanners } from "@/features/shared/overview-banners";
import { QueryState } from "@/features/shared/query-state";
import { useOverview } from "./api";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { toQueryError } from "./query-error";
import type { OverviewApiParams } from "./use-overview-drill-down";

type Props = {
  projectId?: string;
  apiParams: OverviewApiParams;
  isProjectLoading: boolean;
  kpiHref: (id: DrillKpiId) => string;
  pendingHref?: string;
  /** #335: pinned sentiment/safety/intent switch the matching cards to "Đang lọc theo …". */
  filters?: Pick<Filters, "sentiment" | "safety" | "intent">;
};

/** Banners + KPI cards (T-099). */
export function OverviewKpiSection({ projectId, apiParams, isProjectLoading, kpiHref, pendingHref, filters }: Props) {
  const { role } = useRole();
  const query = useOverview(projectId, apiParams);
  return (
    /* Users with no project never reach this view (RequireProject in the app shell); `project` is only null
       while /me loads and during SSR, so show the skeleton then — same markup on server and client. */
    <QueryState
      isLoading={isProjectLoading || query.isLoading}
      error={toQueryError(query.error)}
      onRetry={() => void query.refetch()}
      skeleton={<KpiCardsSkeleton />}
    >
      {/* Zero mentions still renders cards (0 and "—"), never a blank page (BR-032). */}
      {query.data ? (
        <div className="flex flex-col gap-4">
          {/* FR-015: canManage is UX only; the API enforces roles. */}
          <OverviewBanners data={query.data} canManage={role === "admin"} pendingHref={pendingHref} />
          <KpiCards kpis={query.data.kpis} hrefFor={kpiHref} filters={filters} />
        </div>
      ) : null}
    </QueryState>
  );
}
