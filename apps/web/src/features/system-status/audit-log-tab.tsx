"use client";

import { useMemo } from "react";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { QueryState, SkeletonBlock } from "@/features/shared/query-state";
import { toQueryStateError } from "@/lib/semantics/api-errors";
import { flattenUnique } from "@/lib/query/infinite-list";
import { useAuditLogs, useMemberNames, useQueryNames, type AuditLogFilters as ApiFilters } from "./api";
import { AuditLogFilters } from "./audit-log-filters";
import { AuditLogListMobile } from "./audit-log-list-mobile";
import { AuditLogTable } from "./audit-log-table";
import { dayStartUtc, nextDayStartUtc } from "./format";
import { useStatusParams, type AuditLogParams } from "./use-status-params";

/** "Nhật ký thao tác" tab (FR-201, TC-SYS-015). Only mounted for admins; filters live in the URL. */
export function AuditLogTab({ pid, tz }: { pid: string; tz: string }) {
  const { auditFilters, update } = useStatusParams();
  // Days in the project tz → UTC ISO; the audit API treats `to` as exclusive, so send the next day's start.
  const apiFilters = useMemo<ApiFilters>(
    () => ({
      action: auditFilters.action || undefined,
      actorUserId: auditFilters.actor || undefined,
      from: auditFilters.from ? dayStartUtc(auditFilters.from, tz) : undefined,
      to: auditFilters.to ? nextDayStartUtc(auditFilters.to, tz) : undefined,
    }),
    [auditFilters.action, auditFilters.actor, auditFilters.from, auditFilters.to, tz],
  );
  const list = useAuditLogs(pid, apiFilters, true);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  // #343: names for entities / actor filter. Tab is admin-only, so /members (admin) never 403s here.
  const queries = useQueryNames(pid);
  const members = useMemberNames(pid, true);
  const queryNames = useMemo(() => new Map(queries.map((q) => [q.id, q.name])), [queries]);
  const memberNames = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const listProps = { items, tz, queryNames, memberNames };

  return (
    <div className="flex flex-col gap-4">
      <AuditLogFilters
        value={auditFilters}
        onChange={(patch: Partial<AuditLogParams>) => update(patch)}
        members={members}
        onRefresh={() => void list.refetch()}
        isRefreshing={list.isRefetching && !list.isFetchingNextPage}
      />
      <QueryState
        isLoading={list.isLoading}
        error={toQueryStateError(list.error)}
        onRetry={() => void list.refetch()}
        isEmpty={items.length === 0}
        skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
        emptyTitle="Chưa có thao tác nào khớp bộ lọc"
        emptyDescription="Hãy đổi bộ lọc hoặc khoảng ngày."
      >
        <div className="flex flex-col gap-3">
          <AuditLogTable {...listProps} />
          <AuditLogListMobile {...listProps} />
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
