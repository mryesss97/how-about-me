"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useFailedAnalysisRuns } from "./api";
import { AnalysisFailuresTable } from "./analysis-failures-table";
import { RetryAllDialog } from "./retry-all-dialog";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

/** "Lỗi phân tích" tab (FR-175, UX §3.6). Visible to every member; retry actions are admin-only UX. */
export function AnalysisFailuresTab({ pid, tz, isAdmin }: { pid: string; tz: string; isAdmin: boolean }) {
  const list = useFailedAnalysisRuns(pid);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {isAdmin && items.length > 0 ? (
        <div className="flex justify-end">
          <Button color="secondary" size="sm" className="plaque" onClick={() => setConfirmOpen(true)}>
            Thử lại tất cả lỗi (≤ 500)
          </Button>
        </div>
      ) : null}
      <QueryState
        isLoading={list.isLoading}
        error={toStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyTitle="Không có lượt phân tích lỗi"
        emptyDescription="Mọi lượt phân tích gần đây đều thành công."
      >
        <div className="flex flex-col gap-3">
          <AnalysisFailuresTable pid={pid} items={items} tz={tz} isAdmin={isAdmin} />
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
      {isAdmin ? <RetryAllDialog pid={pid} isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} /> : null}
    </div>
  );
}
