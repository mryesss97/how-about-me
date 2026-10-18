"use client";

import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { PageHeader } from "@/features/shared/page-header";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { useSystemStatus } from "./api";
import { OverviewCards } from "./overview-cards";
import { SyncJobsTab } from "./sync-jobs-tab";
import { UpdatedAgo } from "./updated-ago";
import { useStatusParams, type StatusTab } from "./use-status-params";

const DEFAULT_TZ = "Asia/Ho_Chi_Minh";
// "Lỗi phân tích" (T-106) and "Nhật ký thao tác" (T-061) tabs are added by their own tickets.
const TABS: { id: StatusTab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "sync-jobs", label: "Lượt đồng bộ" },
];

/** /system-status (T-060, UX §3.6, FR-170). */
export function SystemStatusView() {
  const { project } = useCurrentProject();
  const { hasRole, isLoading: roleLoading } = useRole();
  const isAdmin = !roleLoading && hasRole(["admin"]);
  const { tab, update } = useStatusParams();
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
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-current={tab === t.id ? "page" : undefined}
            className="plaque-button px-3 py-1.5"
            onClick={() => update({ tab: t.id === "overview" ? null : t.id, job: null })}
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
      ) : project ? (
        <SyncJobsTab pid={project.id} tz={tz} isAdmin={isAdmin} />
      ) : (
        <SkeletonBlock lines={6} className="operate-board p-4" />
      )}
    </div>
  );
}
