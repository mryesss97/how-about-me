"use client";

import { useMemo } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { ApiError } from "@/lib/api/client";
import { useFilters } from "@/lib/filters/use-filters";
import { formatCount } from "@/lib/format/number";
import { flattenUnique, useMentionsList } from "./api";
import { MentionsList } from "./mentions-list";
import { usePinnedParams } from "./mentions-view";

const toStateError = (err: unknown) =>
  err
    ? err instanceof ApiError
      ? { code: err.code, message: err.message, requestId: err.requestId }
      : { message: "Phản hồi không hợp lệ từ máy chủ." }
    : null;

/** Mentions of one phrase on its detail page (#276): the mentions list with `term` (BR-042), same filters as the page. */
export function TermMentions({ term }: { term: string }) {
  const { project } = useCurrentProject();
  const { filters, setFilters, apiParams: live } = useFilters("mentions");
  const params = usePinnedParams(`${JSON.stringify(filters)}|${term}`, { ...live, term });
  const list = useMentionsList(project?.id, params);
  const items = useMemo(() => flattenUnique(list.data?.pages ?? []), [list.data]);
  const total = list.data?.pages[0]?.totalCount ?? null;
  const pagesLoaded = (list.data?.pages.length ?? 0) > 0;

  return (
    <section aria-labelledby="term-mentions" className="operate-board">
      <span aria-hidden className="sign-keyline" />
      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="term-mentions" className="operate-board-title">
            Bài nhắc tới &quot;{term}&quot;
          </h2>
          {total != null ? <p className="text-sm text-secondary">{formatCount(total)} bài nhắc</p> : null}
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
          hrefFor={(id) => `/mentions/${id}`}
          onWidenRange={() => setFilters({ preset: "30d", from: null, to: null })}
        />
      </div>
    </section>
  );
}
