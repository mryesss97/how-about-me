"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Toggle } from "@/components/base/toggle/toggle";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { flattenUnique } from "@/lib/query/infinite-list";
import { ApiError } from "@/lib/api/client";
import { env } from "@/lib/env";
import { formatCount } from "@/lib/format/number";
import { canMarkReviewed, useMarkReviewed, useReviewQueue, type ReviewFilters } from "./api";
import { ReviewDetailSlideout, type RenderReviewDetail } from "./review-detail-slideout";
import { ReviewTable } from "./review-table";
import { ReviewTabs } from "./review-tabs";
import { useReviewParams } from "./use-review-params";

const EMPTY: ReadonlySet<string> = new Set();

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Máy chủ trả về phản hồi không hợp lệ." }
    : null;

/** /reviews body (UX §3.8, FR-195): tabs by reason → toolbar → table → slide-out. Viewer is read-only. */
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
  const canMark = canMarkReviewed(role) && !showReviewed;
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

  return (
    <div className="flex flex-col gap-4">
      {/* #278: white enamel panel with a 2px navy rule, same language as the Overview filter bar. */}
      <div className="flex min-w-0 flex-col gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3">
        <ReviewTabs reason={reason} counts={counts} onChange={params.setReason} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Toggle label="Hiện mục đã xem lại" isSelected={showReviewed} onChange={params.setShowReviewed} />
          {canMark ? (
            <Button size="sm" isDisabled={visibleSelected.size === 0 || mark.isPending} onClick={onMark}>
              {`Đánh dấu đã xem lại (${formatCount(visibleSelected.size)})`}
            </Button>
          ) : null}
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
      {pid && item ? (
        <ReviewDetailSlideout
          pid={pid}
          postId={item}
          canMark={canMark && items.some((i) => i.id === item)}
          onClose={params.closeItem}
          renderDetail={renderDetail}
        />
      ) : null}
    </div>
  );
}
