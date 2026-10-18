"use client";

import { MARK_REVIEWED_MAX } from "@how-about-me/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toggle } from "@/components/base/toggle/toggle";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { useHydrated } from "@/hooks/use-hydrated";
import { flattenUnique } from "@/lib/query/infinite-list";
import { ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";
import { canMarkReviewed, useItemReview, useMarkReviewed, useReviewQueue, type ReviewFilters } from "./api";
import { ReviewDetailSlideout, type RenderReviewDetail } from "./review-detail-slideout";
import { ReviewTable } from "./review-table";
import { ReviewTabs } from "./review-tabs";
import { SelectionBar } from "./selection-bar";
import { useLocateItem } from "./use-locate-item";
import { useQueueNav } from "./use-queue-nav";
import { useReviewParams } from "./use-review-params";

const EMPTY: ReadonlySet<string> = new Set();

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Máy chủ trả về phản hồi không hợp lệ." }
    : null;

/** Esc must not clear the selection while typing or while a dialog is open (#339). */
function escClearsSelection(e: KeyboardEvent): boolean {
  if (e.key !== "Escape" || document.querySelector('[role="dialog"]')) return false;
  const t = e.target;
  return !(t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]'));
}

/**
 * /reviews body (UX §3.8, FR-195): tabs by reason → toolbar → table/cards → selection bar → slide-out.
 * Viewer is read-only (FR-015). Role-dependent UI waits for hydration (#339: no SSR/client mismatch).
 */
export function ReviewsView({ renderDetail }: { renderDetail: RenderReviewDetail }) {
  const { project } = useCurrentProject();
  const { role } = useRole();
  const pid = project?.id;
  const params = useReviewParams();
  const { reason, status, item } = params;
  const filters = useMemo<ReviewFilters>(() => ({ reason, status }), [reason, status]);
  const list = useReviewQueue(pid, filters);
  const mark = useMarkReviewed(pid);
  const tz = project?.timezone ?? env.NEXT_PUBLIC_DEFAULT_TIMEZONE;

  const showReviewed = status === "reviewed";
  const hydrated = useHydrated();
  const canMark = hydrated && canMarkReviewed(role) && !showReviewed;
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const counts = list.data?.pages[0]?.counts;
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;

  // Selection resets when the tab, status or project changes; ids no longer listed are dropped.
  const scope = `${pid ?? ""}|${reason ?? ""}|${status}`;
  const [sel, setSel] = useState<{ scope: string; ids: Set<string> }>({ scope, ids: new Set() });
  const selected = sel.scope === scope ? sel.ids : EMPTY;
  const setSelected = useCallback((ids: Set<string>) => setSel({ scope, ids }), [scope]);
  const visibleSelected = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    return new Set([...selected].filter((id) => ids.has(id)));
  }, [items, selected]);

  const onMark = useCallback(() => {
    const ids = [...visibleSelected];
    if (ids.length === 0) return;
    setSelected(new Set());
    mark.mutate(ids);
  }, [mark, visibleSelected, setSelected]);
  const onClear = useCallback(() => setSelected(new Set()), [setSelected]);

  // Esc clears the selection while the slide-out is closed (UX §3.8, #339).
  const hasSelection = visibleSelected.size > 0;
  useEffect(() => {
    if (!hasSelection || item) return;
    const onKey = (e: KeyboardEvent) => {
      if (escClearsSelection(e)) onClear();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasSelection, item, onClear]);

  const { fetchNextPage } = list;
  const fetchNextIds = useCallback(async () => {
    const r = await fetchNextPage();
    return r.data ? flattenUnique(r.data.pages).map((i) => i.id) : null;
  }, [fetchNextPage]);
  // #390: a deep link outside page 1 loads up to 4 pages, then falls back to the post's own review state.
  const { inList, notFound } = useLocateItem({
    scope,
    item,
    items,
    pages: list.data?.pages.length ?? 0,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    isFetchNextPageError: list.isFetchNextPageError,
    fetchNextPage,
  });
  const review = useItemReview(pid, item, notFound);
  // BR-040: status is server-computed; FR-015: canMark already gates the role.
  const fallbackMark = notFound && review?.status === "unreviewed";
  const { nav, isCurrent } = useQueueNav({
    outOfList: notFound,
    items,
    item,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextIds,
    onMove: params.moveToItem,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* #278: white enamel panel with a 2px navy rule, same language as the Overview filter bar. */}
      <div className="flex min-w-0 flex-col gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3">
        <ReviewTabs reason={reason} counts={counts} onChange={params.setReason} />
        <div className="flex min-h-11 flex-wrap items-center gap-3 md:min-h-0">
          <Toggle label="Hiện mục đã xem lại" isSelected={showReviewed} onChange={params.setShowReviewed} />
        </div>
      </div>
      <ReviewTable
        items={items}
        tz={tz}
        selectable={canMark}
        showReviewed={showReviewed}
        selected={visibleSelected}
        onSelect={setSelected}
        isLoading={!project || list.isLoading}
        error={pagesLoaded ? null : toStateError(list.error)}
        onRetry={() => void list.refetch()}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        nextPageError={pagesLoaded && list.isFetchNextPageError ? toStateError(list.error) : null}
        fetchNextPage={() => void list.fetchNextPage()}
        onOpen={params.openItem}
      />
      {canMark && hasSelection ? (
        <SelectionBar
          count={visibleSelected.size}
          full={visibleSelected.size >= MARK_REVIEWED_MAX}
          isPending={mark.isPending}
          onClear={onClear}
          onMark={onMark}
        />
      ) : null}
      {pid && item ? (
        <ReviewDetailSlideout
          pid={pid}
          postId={item}
          item={items.find((i) => i.id === item)}
          canMark={canMark && (inList || fallbackMark)}
          nav={nav}
          isCurrent={isCurrent}
          onMove={params.moveToItem}
          onClose={params.closeItem}
          renderDetail={renderDetail}
          fallbackReasons={fallbackMark ? review.reasons : undefined}
          outOfList={notFound}
        />
      ) : null}
    </div>
  );
}
