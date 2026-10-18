"use client";

import type { ReviewQueueItem } from "@how-about-me/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCount } from "@/lib/format/number";
import { queueNeighbours } from "./queue-nav";
import type { ReviewNav } from "./review-detail-slideout";

type Args = {
  items: readonly ReviewQueueItem[];
  item: string | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Loads the next page; resolves with the ids of the whole list after the load. */
  fetchNextIds: () => Promise<string[] | null>;
  onMove: (id: string) => void;
  /** #390: the item was looked for and is not in the loaded pages → show the nav frame, disabled. */
  outOfList?: boolean;
};

/**
 * Slide-out navigation over the loaded queue (#339): position "n / loaded" (+ "+" while more pages exist — never the
 * tab count, which may be omitted on timeout BR-032), prev/next with the `lastIndex` fallback when the open item left
 * the list, and loading the next page from the last loaded item.
 */
export function useQueueNav({ items, item, hasNextPage, isFetchingNextPage, fetchNextIds, onMove, outOfList }: Args) {
  const ids = items.map((i) => i.id);
  const index = item ? ids.indexOf(item) : -1;
  // Remember where the open item was (adjust-state-during-render, no effect needed).
  const [last, setLast] = useState<{ item: string | null; index: number | null }>({ item: null, index: null });
  if (item && index >= 0 && (last.item !== item || last.index !== index)) setLast({ item, index });
  const lastIndex = last.item === item ? last.index : null;
  const n = item ? queueNeighbours(ids, item, lastIndex) : null;

  const itemRef = useRef(item);
  const live = useRef({ ids, lastIndex, n });
  useEffect(() => {
    itemRef.current = item;
    live.current = { ids, lastIndex, n };
  });
  const isCurrent = useCallback((id: string) => itemRef.current === id, []);

  const resolveNext = useCallback(async (): Promise<string | null> => {
    const cur = live.current;
    if (cur.n?.nextId) return cur.n.nextId;
    if (!hasNextPage || !itemRef.current) return null;
    const all = await fetchNextIds();
    if (!all) return null;
    const anchor = cur.ids.indexOf(itemRef.current);
    const idx = anchor >= 0 ? anchor : cur.lastIndex;
    return idx === null ? null : queueNeighbours(all, itemRef.current, idx).nextId;
  }, [hasNextPage, fetchNextIds]);

  const total = `${formatCount(ids.length)}${hasNextPage ? "+" : ""}`;
  if (item && outOfList) {
    const off: ReviewNav = {
      label: `– / ${total}`,
      prevDisabled: true,
      nextDisabled: true,
      onPrev: () => {},
      onNext: () => {},
      resolveNext: async () => null,
    };
    return { nav: off, isCurrent };
  }
  // Seen in the list at least once → navigable; a deep link outside the tab gets no nav.
  if (!item || !n || (n.index === null && lastIndex === null)) return { nav: undefined, isCurrent };
  const nav: ReviewNav = {
    label: `${n.index === null ? "–" : formatCount(n.index + 1)} / ${total}`,
    prevDisabled: !n.prevId,
    nextDisabled: !n.nextId && !hasNextPage,
    isLoadingNext: isFetchingNextPage,
    onPrev: () => {
      if (n.prevId) onMove(n.prevId);
    },
    onNext: () => {
      void resolveNext().then((id) => {
        if (id) onMove(id);
      });
    },
    resolveNext,
  };
  return { nav, isCurrent };
}
