"use client";

import { ArrowRight } from "@untitledui/icons";
import { usePathname, useSearchParams } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { ApiError } from "@/lib/api/client";
import { toMentionsHref } from "@/lib/filters/api-params";
import { useFilters } from "@/lib/filters/use-filters";
import { formatCount } from "@/lib/format/number";
import { withBack } from "@/lib/navigation/back-link";
import { flattenUnique, useMentionsList } from "./api";
import { MentionsList } from "./mentions-list";
import { usePinnedParams } from "./mentions-view";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

/** #333 list copy. */
const copy = {
  tabs: { all: "Tất cả", negative: "Tiêu cực", positive: "Tích cực", neutral: "Trung tính" },
  tabsLabel: "Lọc bài nhắc theo cảm xúc",
  listTitle: (term: string) => `Bài nhắc tới "${term}"`,
  openInMentions: "Mở trong Bài nhắc",
} as const;

const TABS = ["negative", "positive", "neutral"] as const;
type Tab = (typeof TABS)[number];
/** #333: list-only sentiment tab; never part of the global filters, never sent to the hero. */
export const listParser = parseAsStringLiteral(TABS).withOptions({ history: "replace", scroll: false });

interface TermMentionsProps {
  term: string;
  /** Tab counts from the hero split (posts with a sentiment); null while loading. */
  counts: Record<Tab, number> | null;
  total: number | null;
}

/**
 * Mentions of one phrase right under the hero (#276, #333 entry-3): `term` (BR-042), page filters, plus a sentiment
 * tab that replaces the `sentiment` filter for this list only.
 */
export function TermMentions({ term, counts, total }: TermMentionsProps) {
  const { project } = useCurrentProject();
  const { filters, setFilters, apiParams: live } = useFilters("mentions");
  const [tab, setTab] = useQueryState("list", listParser);
  const params = usePinnedParams(`${JSON.stringify(filters)}|${term}|${tab ?? ""}`, {
    ...live,
    term,
    ...(tab ? { sentiment: tab } : {}),
  });
  const list = useMentionsList(project?.id, params);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  // #331: the detail page's back link returns to this phrase page with its range.
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const backPath = `${pathname}${search ? `?${search}` : ""}`;
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;

  return (
    <section id="bai-nhac" aria-labelledby="term-mentions" className="operate-board">
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="term-mentions" className="operate-board-title">
            {copy.listTitle(term)}
          </h2>
          {/* FR-142: the one link to /mentions, range pinned, tab carried as `sentiment`. */}
          <PlaqueButton
            href={toMentionsHref({ ...filters, term }, tab ? { sentiment: [tab] } : {})}
            iconTrailing={ArrowRight}
          >
            {copy.openInMentions}
          </PlaqueButton>
        </div>
        <div role="group" aria-label={copy.tabsLabel} className="flex flex-wrap gap-2">
          {([null, ...TABS] as const).map((k) => {
            const n = k ? counts?.[k] : total;
            const selected = tab === k;
            return (
              <PlaqueButton
                key={k ?? "all"}
                size="xs"
                aria-pressed={selected}
                data-selected={selected || undefined}
                onClick={() => void setTab(k)}
              >
                {copy.tabs[k ?? "all"]}
                {n != null ? ` · ${formatCount(n)}` : ""}
              </PlaqueButton>
            );
          })}
        </div>
        <MentionsList
          items={items}
          tz={filters.tz}
          isLoading={!project || list.isLoading}
          error={pagesLoaded ? null : toStateError(list.error)}
          onRetry={() => void list.refetch()}
          hasNextPage={list.hasNextPage}
          isFetchingNextPage={list.isFetchingNextPage}
          nextPageError={pagesLoaded && list.isFetchNextPageError ? toStateError(list.error) : null}
          fetchNextPage={() => void list.fetchNextPage()}
          hrefFor={(id) => withBack(`/mentions/${id}`, backPath)}
          onWidenRange={() => setFilters({ preset: "30d", from: null, to: null })}
        />
      </div>
    </section>
  );
}
