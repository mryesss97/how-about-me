"use client";

import type { MentionSort } from "@how-about-me/contracts";
import { SearchLg } from "@untitledui/icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NativeSelect } from "@/components/base/select/select-native";
import { formatCount } from "@/lib/format/number";

export const SEARCH_DEBOUNCE_MS = 400;

export const SORT_OPTIONS: { value: MentionSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "safety_desc", label: "Mức an toàn nghiêm trọng nhất" },
  { value: "confidence_asc", label: "Độ tin cậy thấp nhất" },
  { value: "relevance_desc", label: "Liên quan nhất" },
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
  /** Extra header actions (T-147 Export CSV), shown next to sort. */
  actions?: ReactNode;
};

export function MentionsCount({
  total,
  loaded,
  hasMore,
  showCount = true,
}: Pick<Props, "total" | "loaded" | "hasMore" | "showCount">) {
  if (!showCount) return <span aria-hidden />;
  if (total === undefined) return <span className="h-7 w-32 animate-pulse rounded-md bg-secondary" aria-hidden />;
  return (
    // Text is "1.234 bài nhắc" / "Đã tải 3+ bài nhắc"; explicit spaces keep it readable for screen readers.
    <p className="flex items-baseline gap-x-0.5 text-[var(--ink)]" data-testid="mentions-count">
      {total === null && hasMore ? <span className="kpi-label">Đã tải </span> : null}
      <span className="kpi-figure kpi-figure--sm">
        {formatCount(total ?? loaded)}
        {total === null && hasMore ? "+" : ""}
      </span>
      <span className="kpi-label"> bài nhắc</span>
    </p>
  );
}

/** Search (debounced, URL `q`) + sort (URL `sort`) + total — UX §3.3, FR-153/FR-161. */
export function MentionsToolbar({ q, sort, onSearch, onSort, total, loaded, hasMore, showCount, actions }: Props) {
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
    <div className="flex flex-col gap-3 border-b-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 lg:sticky lg:top-0 lg:z-10 py-3 md:flex-row md:items-center md:justify-between">
      <MentionsCount total={total} loaded={loaded} hasMore={hasMore} showCount={showCount} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative flex items-center">
          <span className="sr-only">Tìm bài nhắc</span>
          <SearchLg className="pointer-events-none absolute left-3 size-4 text-fg-quaternary" aria-hidden />
          <input
            type="search"
            value={text}
            maxLength={200}
            placeholder="Tìm trong nội dung…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setText("");
            }}
            className="w-full rounded-lg bg-primary py-2 pr-3 pl-9 text-sm text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus:ring-2 focus:ring-brand sm:w-72"
          />
        </label>
        <NativeSelect
          aria-label="Sắp xếp bài nhắc"
          size="sm"
          className="sm:w-64"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(e) => {
            if (isSort(e.target.value)) onSort(e.target.value);
          }}
        />
        {actions}
      </div>
    </div>
  );
}
