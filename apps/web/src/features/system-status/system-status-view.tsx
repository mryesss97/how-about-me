"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { PageHeader } from "@/features/shared/page-header";
import { SectionTabs } from "@/features/shared/section-tabs";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { toQueryStateError } from "@/lib/semantics/api-errors";
import { useLiveQueriesForStatus, useSystemStatus } from "./api";
import { AnalysisFailuresTab } from "./analysis-failures-tab";
import { AuditLogTab } from "./audit-log-tab";
import { countQueriesWithError } from "./format";
import { OverviewCards } from "./overview-cards";
import { SyncJobsTab } from "./sync-jobs-tab";
import { UpdatedAgo } from "./updated-ago";
import { useStatusParams, type StatusTab } from "./use-status-params";
import { PageFrame } from "@/features/shared/page-frame";

const DEFAULT_TZ = "Asia/Ho_Chi_Minh";
const TABS: { id: StatusTab; label: string; adminOnly?: boolean }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "sync-jobs", label: "Lượt đồng bộ" },
  { id: "analysis-failures", label: "Lỗi phân tích" },
  // FR-201 / TC-SYS-015: hidden for non-admins (UX only; the API enforces @Roles("admin")).
  { id: "audit-log", label: "Nhật ký thao tác", adminOnly: true },
];

/** /system-status (T-060, UX §3.6, FR-170). */
export function SystemStatusView() {
  const { project } = useCurrentProject();
  const { hasRole, isLoading: roleLoading } = useRole();
  const isAdmin = !roleLoading && hasRole(["admin"]);
  const { tab: urlTab, tabHref } = useStatusParams();
  // Non-admin deep-link to ?tab=audit-log falls back to Overview once the role is known (no API call).
  const tab: StatusTab = urlTab === "audit-log" && !roleLoading && !isAdmin ? "overview" : urlTab;
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const status = useSystemStatus(project?.id);
  // #342: "Truy vấn đang lỗi" is counted in the browser (no contract change). A failed list load just hides the
  // row; it never blocks the overview.
  const queries = useLiveQueriesForStatus(project?.id);
  const queriesWithError = queries.data ? countQueriesWithError(queries.data.items) : null;
  const tz = project?.timezone ?? DEFAULT_TZ;

  return (
    <PageFrame>
      <PageHeader
        title="Trạng thái hệ thống"
        // #343 ops-10: only the overview polls (FR-170), so "Cập nhật … trước" lives there; lists have "Làm mới".
        actions={tab === "overview" && status.dataUpdatedAt ? <UpdatedAgo updatedAt={status.dataUpdatedAt} /> : null}
      />
      {/* #343: 2×2 grid under `sm`, ≥ 44 px targets; no horizontal scroll so no tab is hidden.
          #348: route sections are links + aria-current (DESIGN.md "Section tabs"), not an ARIA tablist. */}
      <SectionTabs
        ariaLabel="Các mục trạng thái"
        scroll={false}
        items={tabs.map((t) => ({ href: tabHref(t.id), label: t.label, current: tab === t.id }))}
      />
      {tab === "overview" ? (
        <QueryState
          isLoading={!project || status.isLoading}
          error={status.data ? null : toQueryStateError(status.error)}
          onRetry={() => void status.refetch()}
          skeleton={<SkeletonBlock lines={8} className="operate-board p-4" />}
        >
          {status.data ? (
            <OverviewCards data={status.data} tz={tz} isAdmin={isAdmin} queriesWithError={queriesWithError} />
          ) : null}
        </QueryState>
      ) : !project || (tab === "audit-log" && roleLoading) ? (
        <SkeletonBlock lines={6} className="operate-board p-4" />
      ) : tab === "audit-log" ? (
        <AuditLogTab pid={project.id} tz={tz} />
      ) : tab === "analysis-failures" ? (
        <AnalysisFailuresTab pid={project.id} tz={tz} isAdmin={isAdmin} />
      ) : (
        <SyncJobsTab pid={project.id} tz={tz} isAdmin={isAdmin} />
      )}
    </PageFrame>
  );
}
