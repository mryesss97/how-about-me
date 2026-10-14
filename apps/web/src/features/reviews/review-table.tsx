"use client";

import { MARK_REVIEWED_MAX, type ReviewQueueItem } from "@how-about-me/contracts";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { ErrorState, QueryState, SkeletonBlock, type QueryStateError } from "@/features/shared/query-state";
import { ReviewRow } from "./review-row";

type Props = {
  items: ReviewQueueItem[];
  tz: string;
  selectable: boolean;
  showReviewed: boolean;
  selected: ReadonlySet<string>;
  onSelect: (next: Set<string>) => void;
  isLoading: boolean;
  error: QueryStateError | null;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  nextPageError: QueryStateError | null;
  fetchNextPage: () => void;
  onOpen: (id: string) => void;
};

/** Select all visible rows, capped at MARK_REVIEWED_MAX (one API call). */
export function selectAllCapped(items: readonly { id: string }[]): Set<string> {
  return new Set(items.slice(0, MARK_REVIEWED_MAX).map((i) => i.id));
}

const TH = "px-3 py-2 text-left text-xs font-semibold text-tertiary";

/** Review queue table (UX §3.8): selection ≤ 50, load more, empty / error / loading states. */
export function ReviewTable(p: Props) {
  const full = p.selected.size >= MARK_REVIEWED_MAX;
  const allSelected = p.items.length > 0 && p.items.slice(0, MARK_REVIEWED_MAX).every((i) => p.selected.has(i.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(p.selected);
    if (on) next.add(id);
    else next.delete(id);
    p.onSelect(next);
  };
  return (
    <QueryState
      emptyIllustration="empty"
      isLoading={p.isLoading}
      error={p.error}
      onRetry={p.onRetry}
      isEmpty={p.items.length === 0}
      skeleton={<SkeletonBlock lines={6} className="operate-board p-4" />}
      emptyTitle={p.showReviewed ? "Chưa có mục nào đã xem lại" : "Không có mục nào cần xem lại"}
      emptyDescription={p.showReviewed ? "Các mục bạn đánh dấu đã xem lại sẽ hiện ở đây." : "Đã xem hết."}
    >
      <div className="flex flex-col gap-3">
        {p.selectable && full ? <p className="text-sm text-tertiary">Tối đa {MARK_REVIEWED_MAX} mục mỗi lần</p> : null}
        {/* #278: table sits in an enamel board; it scrolls horizontally inside the board, never the page. */}
        <div className="operate-board min-w-0">
          <span aria-hidden className="sign-keyline" />
          <div className="relative overflow-x-auto p-3">
            <table className="w-full" aria-busy={p.isFetchingNextPage}>
              <thead className="border-b border-secondary bg-secondary">
                <tr>
                  {p.selectable ? (
                    <th className="w-10 px-3 py-2">
                      <Checkbox
                        aria-label="Chọn tất cả"
                        isSelected={allSelected}
                        isIndeterminate={!allSelected && p.selected.size > 0}
                        onChange={(on) => p.onSelect(on ? selectAllCapped(p.items) : new Set())}
                      />
                    </th>
                  ) : null}
                  <th className={TH}>Bài viết</th>
                  <th className={TH}>Lý do</th>
                  <th className={TH}>Mức liên quan</th>
                  <th className={TH}>Cảm xúc</th>
                  <th className={TH}>Độ tin cậy</th>
                  <th className={TH}>Trạng thái</th>
                  {p.showReviewed ? <th className={TH}>Người xem lại</th> : null}
                </tr>
              </thead>
              <tbody>
                {p.items.map((item) => (
                  <ReviewRow
                    key={item.id}
                    item={item}
                    tz={p.tz}
                    selectable={p.selectable}
                    selected={p.selected.has(item.id)}
                    disabled={full && !p.selected.has(item.id)}
                    showReviewed={p.showReviewed}
                    onToggle={toggle}
                    onOpen={p.onOpen}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {p.nextPageError ? <ErrorState error={p.nextPageError} onRetry={p.fetchNextPage} /> : null}
        {p.hasNextPage && !p.nextPageError ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={p.isFetchingNextPage}
              onClick={p.fetchNextPage}
              className="plaque-button px-3 py-1.5 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            >
              {p.isFetchingNextPage ? "Đang tải…" : "Tải thêm"}
            </button>
          </div>
        ) : null}
      </div>
    </QueryState>
  );
}
