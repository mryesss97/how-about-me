"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { PageHeader } from "@/features/shared/page-header";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { useSystemStatus } from "./api";
import { AnalysisFailuresTab } from "./analysis-failures-tab";
import { AuditLogTab } from "./audit-log-tab";
import { OverviewCards } from "./overview-cards";
import { SyncJobsTab } from "./sync-jobs-tab";
import { UpdatedAgo } from "./updated-ago";
import { useStatusParams, type StatusTab } from "./use-status-params";

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
  const { tab: urlTab, update } = useStatusParams();
  // Non-admin deep-link to ?tab=audit-log falls back to Overview once the role is known (no API call).
  const tab: StatusTab = urlTab === "audit-log" && !roleLoading && !isAdmin ? "overview" : urlTab;
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const status = useSystemStatus(project?.id);
  const tz = project?.timezone ?? DEFAULT_TZ;
  const err = status.error instanceof ApiError ? status.error : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <PageHeader
        title="Trạng thái hệ thống"
        actions={status.dataUpdatedAt ? <UpdatedAgo updatedAt={status.dataUpdatedAt} /> : null}
      />
      <div role="tablist" aria-label="Các mục trạng thái" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-current={tab === t.id ? "page" : undefined}
            className="plaque-button px-3 py-1.5"
            onClick={() => update({ tab: t.id === "overview" ? null : t.id, job: null, action: null })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <QueryState
          isLoading={!project || status.isLoading}
          error={
            status.data
              ? null
              : status.error
                ? err
                  ? { code: err.code, message: err.message, requestId: err.requestId }
                  : {}
                : null
          }
          onRetry={() => void status.refetch()}
          skeleton={<SkeletonBlock lines={8} className="operate-board p-4" />}
        >
          {status.data ? <OverviewCards data={status.data} tz={tz} isAdmin={isAdmin} /> : null}
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
    </div>
  );
}
