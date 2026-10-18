"use client";

import type { MentionListItem } from "@how-about-me/contracts";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { EmptyReason } from "@/features/shared/overview-banners";
import { ErrorState, QueryState, SkeletonBlock, type QueryStateError } from "@/features/shared/query-state";
import { mentionsEmptyCopy } from "./empty-copy";
import { MentionRow } from "./mention-row";
import { PlaqueButton } from "@/features/shared/plaque-button";

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
  /** Plain-click handler; omitted → the row link navigates normally. */
  onOpen?: (id: string) => void;
  /** Real href of each row (full page detail, #326). */
  hrefFor: (id: string) => string;
  onWidenRange: () => void;
  /** FR-159: cause of an empty list (defaults to "none"). */
  emptyReason?: EmptyReason;
  pendingCount?: number;
  canManage?: boolean;
  pendingHref?: string;
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
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([]);
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

  const onRowKey = (i: number) => (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.target !== e.currentTarget) return;
    const next = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    rowRefs.current[next]?.focus();
  };

  const empty = mentionsEmptyCopy({
    reason: p.emptyReason ?? "none",
    pendingCount: p.pendingCount ?? 0,
    canManage: p.canManage ?? false,
    onWidenRange: p.onWidenRange,
    pendingHref: p.pendingHref,
  });

  return (
    <QueryState
      emptyIllustration="empty"
      isLoading={p.isLoading}
      error={p.error}
      onRetry={p.onRetry}
      isEmpty={p.items.length === 0}
      skeleton={<MentionsListSkeleton />}
      emptyTitle={empty.title}
      emptyDescription={empty.description}
      emptyAction={empty.action}
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
              href={p.hrefFor(item.id)}
              onOpen={p.onOpen}
              onKeyDown={onRowKey(i)}
            />
          ))}
        </div>
        {nextPageError ? <ErrorState error={nextPageError} onRetry={fetchNextPage} /> : null}
        {hasNextPage && !nextPageError ? (
          <div ref={sentinel} className="flex justify-center">
            <PlaqueButton isLoading={isFetchingNextPage} onClick={fetchNextPage}>
              Tải thêm
            </PlaqueButton>
          </div>
        ) : null}
      </div>
    </QueryState>
  );
}
