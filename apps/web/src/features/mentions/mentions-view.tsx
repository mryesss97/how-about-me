"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MentionSort } from "@how-about-me/contracts";
import { useOverview } from "@/features/shared/use-overview";
import { OverviewBanners } from "@/features/shared/overview-banners";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { useHydrated } from "@/hooks/use-hydrated";
import { ApiError } from "@/lib/api/client";
import { useFilters } from "@/lib/filters/use-filters";
import { flattenUnique, useMentionsList } from "./api";
import { MentionsList } from "./mentions-list";
import { BulkReanalyzeButton, canBulkReanalyze } from "./bulk-reanalyze-dialog";
import { canExport, ExportButton } from "./export-button";
import { MentionsToolbar } from "./mentions-toolbar";

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
  const router = useRouter();
  const search = useSearchParams();
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

  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const firstPage = list.data?.pages[0];
  const total = firstPage ? (firstPage.totalCount ?? null) : undefined;
  // Users with no project never reach this view (RequireProject in the app shell), same as Overview.
  const isFirstLoad = !project || list.isLoading;
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;

  const onSearch = useCallback((q: string | null) => setFilters({ q }), [setFilters]);
  const onSort = useCallback((sort: MentionSort) => setFilters({ sort }), [setFilters]);
  const onOpen = useCallback(
    (id: string) => {
      const qs = search?.toString();
      router.push(`/mentions/${id}${qs ? `?${qs}` : ""}`);
    },
    [router, search],
  );

  return (
    <div className="flex flex-col gap-4">
      {overview.data ? <OverviewBanners data={overview.data} canManage={role === "admin"} /> : null}
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
              {canBulkReanalyze(role) ? <BulkReanalyzeButton pid={project.id} params={apiParams} /> : null}
              {canExport(role, settings) ? <ExportButton pid={project.id} params={apiParams} /> : null}
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
        onOpen={onOpen}
        onWidenRange={() => setFilters({ preset: "30d", from: null, to: null })}
      />
    </div>
  );
}
