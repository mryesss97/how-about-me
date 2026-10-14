"use client";

import type { MentionListItem } from "@how-about-me/contracts";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/base/buttons/button";
import { ErrorState, QueryState, SkeletonBlock, type QueryStateError } from "@/features/shared/query-state";
import { MentionRow } from "./mention-row";

type Props = {
  items: MentionListItem[];
  query?: string | null;
  tz: string;
  isLoading: boolean;
  error: QueryStateError | null;
  onRetry: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Error while loading a further page: pages already loaded stay visible. */
  nextPageError: QueryStateError | null;
  fetchNextPage: () => void;
  onOpen: (id: string) => void;
  onWidenRange: () => void;
};

export function MentionsListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonBlock key={i} lines={3} className="rounded-xl border border-secondary p-4" />
      ))}
    </div>
  );
}

/** List body with load more + infinite scroll and ↑/↓ roving focus (UX §3.3, TC-MEN-020). */
export function MentionsList(p: Props) {
  const rowRefs = useRef<(HTMLElement | null)[]>([]);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, nextPageError } = p;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined" || !hasNextPage || nextPageError) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, nextPageError]);

  const onRowKey = (i: number) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    rowRefs.current[next]?.focus();
  };

  return (
    <QueryState
      emptyIllustration="empty"
      isLoading={p.isLoading}
      error={p.error}
      onRetry={p.onRetry}
      isEmpty={p.items.length === 0}
      skeleton={<MentionsListSkeleton />}
      emptyAction={
        <Button color="secondary" size="sm" onClick={p.onWidenRange}>
          Widen time range
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="feed" aria-busy={isFetchingNextPage} className="flex flex-col gap-3">
          {p.items.map((item, i) => (
            <MentionRow
              key={item.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              item={item}
              query={p.query}
              tz={p.tz}
              onOpen={p.onOpen}
              onKeyDown={onRowKey(i)}
            />
          ))}
        </div>
        {nextPageError ? <ErrorState error={nextPageError} onRetry={fetchNextPage} /> : null}
        {hasNextPage && !nextPageError ? (
          <div ref={sentinel} className="flex justify-center">
            <Button color="secondary" size="sm" isDisabled={isFetchingNextPage} onClick={fetchNextPage}>
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </QueryState>
  );
}
