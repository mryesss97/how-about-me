"use client";

import { MARK_REVIEWED_MAX, type ReviewQueueItem } from "@how-about-me/contracts";
import { Button } from "@/components/base/buttons/button";
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
      skeleton={<SkeletonBlock lines={6} className="rounded-xl border border-secondary p-4" />}
      emptyTitle={p.showReviewed ? "No reviewed items" : "No items need review"}
      emptyDescription={p.showReviewed ? "Items you mark as reviewed appear here." : "All caught up."}
    >
      <div className="flex flex-col gap-3">
        {p.selectable && full ? <p className="text-sm text-tertiary">Up to {MARK_REVIEWED_MAX} at a time</p> : null}
        <div className="overflow-x-auto rounded-xl border border-secondary">
          <table className="w-full" aria-busy={p.isFetchingNextPage}>
            <thead className="border-b border-secondary bg-secondary">
              <tr>
                {p.selectable ? (
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      aria-label="Select all"
                      isSelected={allSelected}
                      isIndeterminate={!allSelected && p.selected.size > 0}
                      onChange={(on) => p.onSelect(on ? selectAllCapped(p.items) : new Set())}
                    />
                  </th>
                ) : null}
                <th className={TH}>Post</th>
                <th className={TH}>Reasons</th>
                <th className={TH}>Relevance</th>
                <th className={TH}>Sentiment</th>
                <th className={TH}>Confidence</th>
                <th className={TH}>Status</th>
                {p.showReviewed ? <th className={TH}>Reviewed by</th> : null}
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
        {p.nextPageError ? <ErrorState error={p.nextPageError} onRetry={p.fetchNextPage} /> : null}
        {p.hasNextPage && !p.nextPageError ? (
          <div className="flex justify-center">
            <Button color="secondary" size="sm" isDisabled={p.isFetchingNextPage} onClick={p.fetchNextPage}>
              {p.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </QueryState>
  );
}
