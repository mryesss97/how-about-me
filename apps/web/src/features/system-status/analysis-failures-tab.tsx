"use client";

import { useMemo, useState } from "react";
import { RefreshCcw01 } from "@untitledui/icons";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { toQueryStateError } from "@/lib/semantics/api-errors";
import { formatCount } from "@/lib/format/number";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useFailedAnalysisRuns } from "./api";
import { AnalysisFailuresListMobile } from "./analysis-failures-list-mobile";
import { AnalysisFailuresTable } from "./analysis-failures-table";
import { RetryAllDialog } from "./retry-all-dialog";
import { useRowRetry } from "./use-row-retry";

/** "Lỗi phân tích" tab (FR-175, UX §3.6). Visible to every member; retry actions are admin-only UX. */
export function AnalysisFailuresTab({ pid, tz, isAdmin }: { pid: string; tz: string; isAdmin: boolean }) {
  const list = useFailedAnalysisRuns(pid);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const total = list.data?.pages[0]?.totalCount;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { busyIds, onRetry } = useRowRetry(pid);
  const listProps = { items, tz, isAdmin, busyIds, onRetry };

  return (
    <div className="flex flex-col gap-4">
      {list.data ? (
        // #330/#343: toolbar panel for every role — count + "Làm mới"; bulk retry stays admin-only UX (FR-015).
        <div
          data-testid="failures-toolbar"
          className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3"
        >
          <p className="text-sm text-secondary">
            {total != null ? `${formatCount(total)} lượt lỗi` : `Đã tải ${formatCount(items.length)} lượt lỗi`}
          </p>
          <div className="flex flex-wrap gap-2">
            <PlaqueButton
              className="min-h-11"
              iconLeading={RefreshCcw01}
              isLoading={list.isRefetching && !list.isFetchingNextPage}
              onClick={() => void list.refetch()}
            >
              Làm mới
            </PlaqueButton>
            {isAdmin && (total ?? items.length) > 0 ? (
              <PlaqueButton className="min-h-11" onClick={() => setConfirmOpen(true)}>
                Thử lại tất cả (≤ 500)
              </PlaqueButton>
            ) : null}
          </div>
        </div>
      ) : null}
      <QueryState
        isLoading={list.isLoading}
        error={toQueryStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyTitle="Không có lượt phân tích lỗi"
        emptyDescription="Mọi lượt phân tích gần đây đều thành công."
      >
        <div className="flex flex-col gap-3">
          <AnalysisFailuresTable {...listProps} />
          <AnalysisFailuresListMobile {...listProps} />
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <PlaqueButton isLoading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Tải thêm
              </PlaqueButton>
            </div>
          ) : null}
        </div>
      </QueryState>
      {isAdmin ? (
        <RetryAllDialog pid={pid} total={total} isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} />
      ) : null}
    </div>
  );
}
