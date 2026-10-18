"use client";

import { useMemo } from "react";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { ApiError } from "@/lib/api/client";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useAuditLogs, type AuditLogFilters as ApiFilters } from "./api";
import { AuditLogFilters } from "./audit-log-filters";
import { AuditLogTable } from "./audit-log-table";
import { dayStartUtc, nextDayStartUtc } from "./format";
import { useStatusParams, type AuditLogParams } from "./use-status-params";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

/** "Nhật ký thao tác" tab (FR-201, TC-SYS-015). Only mounted for admins; filters live in the URL. */
export function AuditLogTab({ pid, tz }: { pid: string; tz: string }) {
  const { auditFilters, update } = useStatusParams();
  // Days in the project tz → UTC ISO; the audit API treats `to` as exclusive, so send the next day's start.
  const apiFilters = useMemo<ApiFilters>(
    () => ({
      action: auditFilters.action || undefined,
      from: auditFilters.from ? dayStartUtc(auditFilters.from, tz) : undefined,
      to: auditFilters.to ? nextDayStartUtc(auditFilters.to, tz) : undefined,
    }),
    [auditFilters.action, auditFilters.from, auditFilters.to, tz],
  );
  const list = useAuditLogs(pid, apiFilters, true);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);

  return (
    <div className="flex flex-col gap-4">
      <AuditLogFilters value={auditFilters} onChange={(patch: Partial<AuditLogParams>) => update(patch)} />
      <QueryState
        isLoading={list.isLoading}
        error={toStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyTitle="Chưa có thao tác nào khớp bộ lọc"
        emptyDescription="Hãy đổi bộ lọc hoặc khoảng ngày."
      >
        <div className="flex flex-col gap-3">
          <AuditLogTable items={items} tz={tz} />
          {list.hasNextPage ? (
            <div className="flex justify-center">
              <PlaqueButton isLoading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                Tải thêm
              </PlaqueButton>
            </div>
          ) : null}
        </div>
      </QueryState>
    </div>
  );
}
