"use client";

import { useCallback, useMemo, useState } from "react";
import type { MentionSort } from "@how-about-me/contracts";
import { useOverview } from "@/features/shared/use-overview";
import { emptyReasonFor, OverviewBanners } from "@/features/shared/overview-banners";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { useHydrated } from "@/hooks/use-hydrated";
import { ApiError } from "@/lib/api/client";
import { toMentionsHref } from "@/lib/filters/api-params";
import { coverageDrillDown } from "@/lib/filters/drill-down";
import { useFilters } from "@/lib/filters/use-filters";
import { flattenUnique, useMentionsList } from "./api";
import { MentionsList } from "./mentions-list";
import { BulkReanalyzeButton, canBulkReanalyze } from "./bulk-reanalyze-dialog";
import { canExport, ExportButton } from "./export-button";
import { MentionsToolbar } from "./mentions-toolbar";
import { MentionDetailSlideout } from "./detail/mention-detail-slideout";
import { useMentionItem } from "./use-mention-item";

/**
 * `useFilters` re-resolves relative presets ("last 7 days") against `now` floored to the minute, so its params
 * change every minute. For an infinite list that would re-key the query and drop every loaded page mid-scroll.
 * Pin the params until the URL filters themselves change (or the page reloads).
 */
export function usePinnedParams(filtersKey: string, params: Record<string, string>): Record<string, string> {
  const [pinned, setPinned] = useState({ key: filtersKey, params });
  if (pinned.key !== filtersKey) {
    setPinned({ key: filtersKey, params });
    return params;
  }
  return pinned.params;
}

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

/** /mentions body (T-103): banners → toolbar → list. Filter bar is rendered by the page. */
export function MentionsView() {
  // #326: `?item=` opens the slide-out over the list; the list stays mounted (scroll + loaded pages kept).
  const { item, openItem, closeItem, detailHref } = useMentionItem();
  const { project } = useCurrentProject();
  const { role, settings } = useRole();
  const hydrated = useHydrated();
  const { filters, setFilters, apiParams: liveParams } = useFilters("mentions");
  const { apiParams: liveAnalyticsParams } = useFilters("analytics");
  const filtersKey = JSON.stringify(filters);
  const apiParams = usePinnedParams(filtersKey, liveParams);
  // Banners only need coverage for the range; `compare` would add a previous-period query for nothing.
  const { compare: _compare, ...bannerParams } = liveAnalyticsParams;
  const analyticsParams = usePinnedParams(filtersKey, bannerParams);
  const list = useMentionsList(project?.id, apiParams);
  // FR-159: sync-failed / analysis-pending banners reuse the overview coverage for the same range.
  const overview = useOverview(project?.id, analyticsParams);
  // #328: pending link pinned to the same range as the banner count (metric-definitions §2).
  const pinnedTo = analyticsParams.to;
  const pendingHref = toMentionsHref(
    { ...filters, q: null },
    coverageDrillDown(),
    pinnedTo ? new Date(pinnedTo) : undefined,
  );

  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const firstPage = list.data?.pages[0];
  const total = firstPage ? (firstPage.totalCount ?? null) : undefined;
  // Users with no project never reach this view (RequireProject in the app shell), same as Overview.
  const isFirstLoad = !project || list.isLoading;
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;

  const onSearch = useCallback((q: string | null) => setFilters({ q }), [setFilters]);
  const onSort = useCallback((sort: MentionSort) => setFilters({ sort }), [setFilters]);

  return (
    <div className="flex flex-col gap-4">
      {overview.data ? (
        <OverviewBanners data={overview.data} canManage={role === "admin"} pendingHref={pendingHref} />
      ) : null}
      <MentionsToolbar
        q={filters.q}
        sort={filters.sort}
        onSearch={onSearch}
        onSort={onSort}
        total={total}
        loaded={items.length}
        hasMore={list.hasNextPage}
        showCount={pagesLoaded || !list.isError}
        actions={
          // Same pinned params as the visible list so the CSV / re-analysis preview matches the shown count (FR-180).
          hydrated && project ? (
            <div className="flex gap-2">
              {canExport(role, settings) ? <ExportButton pid={project.id} params={apiParams} /> : null}
              {/* #337: the heavy admin action goes last. */}
              {canBulkReanalyze(role) ? <BulkReanalyzeButton pid={project.id} params={apiParams} /> : null}
            </div>
          ) : null
        }
      />
      <MentionsList
        items={items}
        query={filters.q}
        tz={filters.tz}
        isLoading={isFirstLoad}
        error={pagesLoaded ? null : toStateError(list.error)}
        onRetry={() => void list.refetch()}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        nextPageError={pagesLoaded && list.isFetchNextPageError ? toStateError(list.error) : null}
        fetchNextPage={() => void list.fetchNextPage()}
        onOpen={openItem}
        hrefFor={detailHref}
        onWidenRange={() => setFilters({ preset: "30d", from: null, to: null })}
        emptyReason={emptyReasonFor(overview.data)}
        pendingCount={overview.data?.coverage.pendingMentions ?? 0}
        canManage={role === "admin"}
        pendingHref={pendingHref}
      />
      {item ? (
        <MentionDetailSlideout key={item} mentionId={item} onClose={closeItem} fullPageHref={detailHref(item)} />
      ) : null}
    </div>
  );
}
