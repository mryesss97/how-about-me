"use client";

import type { MentionSort } from "@how-about-me/contracts";
import { SearchLg } from "@untitledui/icons";
import { useEffect, useRef, useState } from "react";
import { NativeSelect } from "@/components/base/select/select-native";
import { formatCount } from "@/lib/format/number";

export const SEARCH_DEBOUNCE_MS = 400;

export const SORT_OPTIONS: { value: MentionSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "safety_desc", label: "Highest safety severity" },
  { value: "confidence_asc", label: "Lowest confidence" },
  { value: "relevance_desc", label: "Highest relevance" },
];

const isSort = (v: string): v is MentionSort => SORT_OPTIONS.some((o) => o.value === v);

type Props = {
  q: string | null;
  sort: MentionSort;
  onSearch: (q: string | null) => void;
  onSort: (sort: MentionSort) => void;
  /** `undefined` while the first page loads; `null` when the API omitted the count (timeout, T-095). */
  total: number | null | undefined;
  loaded: number;
  /** More pages exist — without a total, the loaded count is only a lower bound. */
  hasMore: boolean;
  /** False when the first page failed: the error state speaks for itself, no count and no skeleton. */
  showCount?: boolean;
};

export function MentionsCount({
  total,
  loaded,
  hasMore,
  showCount = true,
}: Pick<Props, "total" | "loaded" | "hasMore" | "showCount">) {
  if (!showCount) return <span aria-hidden />;
  if (total === undefined) return <span className="h-5 w-28 animate-pulse rounded-md bg-secondary" aria-hidden />;
  return (
    <p className="text-sm font-medium text-secondary" data-testid="mentions-count">
      {total !== null
        ? `${formatCount(total)} mentions`
        : hasMore
          ? `${formatCount(loaded)}+ mentions loaded`
          : `${formatCount(loaded)} mentions`}
    </p>
  );
}

/** Search (debounced, URL `q`) + sort (URL `sort`) + total — UX §3.3, FR-153/FR-161. */
export function MentionsToolbar({ q, sort, onSearch, onSort, total, loaded, hasMore, showCount }: Props) {
  const [text, setText] = useState(q ?? "");
  const lastSent = useRef(q ?? "");

  // Keep the box in sync when the URL changes elsewhere (back/forward, Reset).
  useEffect(() => {
    if ((q ?? "") !== lastSent.current) {
      lastSent.current = q ?? "";
      setText(q ?? "");
    }
  }, [q]);

  useEffect(() => {
    if (text === lastSent.current) return;
    const t = setTimeout(() => {
      lastSent.current = text;
      onSearch(text.trim() ? text : null);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text, onSearch]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <MentionsCount total={total} loaded={loaded} hasMore={hasMore} showCount={showCount} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex items-center">
          <span className="sr-only">Search mentions</span>
          <SearchLg className="pointer-events-none absolute left-3 size-4 text-fg-quaternary" aria-hidden />
          <input
            type="search"
            value={text}
            maxLength={200}
            placeholder="Search text…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setText("");
            }}
            className="w-full rounded-lg bg-primary py-2 pr-3 pl-9 text-sm text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus:ring-2 focus:ring-brand sm:w-72"
          />
        </label>
        <NativeSelect
          aria-label="Sort mentions"
          size="sm"
          className="sm:w-56"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(e) => {
            if (isSort(e.target.value)) onSort(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
