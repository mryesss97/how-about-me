"use client";

import type { ReviewQueueItem } from "@how-about-me/contracts";
import { useEffect, useState } from "react";

/** #390: a deep-linked item is looked for in at most this many queue pages (4 × 25 = 100 rows). */
export const ITEM_SEARCH_MAX_PAGES = 4;

type Args = {
  scope: string;
  item: string | null;
  items: readonly ReviewQueueItem[];
  pages: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => Promise<unknown>;
};

/**
 * #390: loads further queue pages (capped) until the open item shows up. `notFound` = never seen in this scope and
 * the search stopped — the slide-out then falls back to the post's own review state. An item that was seen and
 * then left the list (optimistic remove after mark) is never searched for again.
 */
export function useLocateItem({
  scope,
  item,
  items,
  pages,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: Args) {
  const key = `${scope}|${item ?? ""}`;
  const inList = !!item && items.some((i) => i.id === item);
  // Adjust-state-during-render: remember the item was seen in this scope.
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (inList && seenKey !== key) setSeenKey(key);
  const seen = inList || seenKey === key;

  const searching =
    !!item && !seen && pages > 0 && hasNextPage && pages < ITEM_SEARCH_MAX_PAGES && !isFetchNextPageError;
  const notFound = !!item && !seen && pages > 0 && !searching;

  // `pages` in deps: the fetching flag may flip true→false within one batch, so re-run per loaded page.
  useEffect(() => {
    if (searching && !isFetchingNextPage) void fetchNextPage();
  }, [searching, isFetchingNextPage, fetchNextPage, pages]);

  return { inList, searching, notFound };
}
