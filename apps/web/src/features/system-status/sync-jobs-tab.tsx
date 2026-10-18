"use client";

import { useMemo } from "react";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { toQueryStateError } from "@/lib/semantics/api-errors";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useQueryNames, useSyncJobs, type SyncJobFilters } from "./api";
import { dayEndUtc, dayStartUtc } from "./format";
import { SyncJobDrawer } from "./sync-job-drawer";
import { SyncJobsFilters } from "./sync-jobs-filters";
import { SyncJobsListMobile } from "./sync-jobs-list-mobile";
import { SyncJobsTable } from "./sync-jobs-table";
import { useStatusParams, type SyncJobsParams } from "./use-status-params";

/** "Lượt đồng bộ" tab (FR-081, TC-SYS-013). Filters + open job live in the URL. */
export function SyncJobsTab({ pid, tz, isAdmin }: { pid: string; tz: string; isAdmin: boolean }) {
  const { filters, jobId, update } = useStatusParams();
  // Calendar days are interpreted in the project timezone, then sent as UTC ISO (CLAUDE.md timestamps rule).
  const apiFilters = useMemo<SyncJobFilters>(
    () => ({
      queryId: filters.queryId || undefined,
      status: filters.status || undefined,
      from: filters.from ? dayStartUtc(filters.from, tz) : undefined,
      to: filters.to ? dayEndUtc(filters.to, tz) : undefined,
    }),
    [filters.queryId, filters.status, filters.from, filters.to, tz],
  );
  const list = useSyncJobs(pid, apiFilters);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const names = useQueryNames(pid);
  const queryNames = useMemo(() => new Map(names.map((q) => [q.id, q.name])), [names]);

  const listProps = {
    items,
    tz,
    queryNames,
    currentQueryId: filters.queryId,
    onOpen: (id: string) => update({ job: id }),
  };
  const onFilter = (patch: Partial<SyncJobsParams>) => update({ ...patch, job: null });

  return (
    <div className="flex flex-col gap-4">
      <SyncJobsFilters
        pid={pid}
        value={filters}
        onChange={onFilter}
        onRefresh={() => void list.refetch()}
        isRefreshing={list.isRefetching && !list.isFetchingNextPage}
      />
      <QueryState
        isLoading={list.isLoading}
        error={toQueryStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyTitle="Chưa có lượt đồng bộ nào khớp bộ lọc"
        emptyDescription="Hãy đổi bộ lọc hoặc khoảng ngày."
      >
        <div className="flex flex-col gap-3">
          <SyncJobsTable {...listProps} />
          <SyncJobsListMobile {...listProps} />
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <PlaqueButton isLoading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Tải thêm
              </PlaqueButton>
            </div>
          ) : null}
        </div>
      </QueryState>
      {jobId ? (
        <SyncJobDrawer
          key={jobId}
          pid={pid}
          jobId={jobId}
          tz={tz}
          isAdmin={isAdmin}
          onClose={() => update({ job: null })}
        />
      ) : null}
    </div>
  );
}
