"use client";

import { useMemo } from "react";
import { Button } from "@/components/base/buttons/button";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useQueryNames, useSyncJobs, type SyncJobFilters } from "./api";
import { dayEndUtc, dayStartUtc } from "./format";
import { SyncJobDrawer } from "./sync-job-drawer";
import { SyncJobsFilters } from "./sync-jobs-filters";
import { SyncJobsTable } from "./sync-jobs-table";
import { useStatusParams, type SyncJobsParams } from "./use-status-params";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

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

  const onFilter = (patch: Partial<SyncJobsParams>) => update({ ...patch, job: null });

  return (
    <div className="flex flex-col gap-4">
      <SyncJobsFilters pid={pid} value={filters} onChange={onFilter} />
      <QueryState
        isLoading={list.isLoading}
        error={toStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyTitle="Chưa có lượt đồng bộ nào khớp bộ lọc"
        emptyDescription="Hãy đổi bộ lọc hoặc khoảng ngày."
      >
        <div className="flex flex-col gap-3">
          <SyncJobsTable items={items} tz={tz} queryNames={queryNames} onOpen={(id) => update({ job: id })} />
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                color="secondary"
                size="sm"
                className="plaque"
                isLoading={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                Tải thêm
              </Button>
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
