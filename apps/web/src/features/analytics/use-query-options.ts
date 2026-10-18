"use client";

import { ListeningQueryPageSchema, type ListeningQuery } from "@how-about-me/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SelectItemType } from "@/components/base/select/select-shared";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

/** Must match `QUERIES_PAGE_SIZE` in features/listening-queries/api.ts — both hooks share one cache entry. */
const PAGE_SIZE = 200;

export type QueryFilterOptions = {
  items: SelectItemType[];
  /** id → display label (tags prefixed with `#`), used by chips and charts. */
  names: Record<string, string>;
};

type QueryLike = Pick<ListeningQuery, "id" | "displayName" | "queryType" | "deletedAt">;

/** Tags render as `#name`; never double the `#` when the stored name already has one. */
export function queryLabel(q: Pick<QueryLike, "displayName" | "queryType">): string {
  if (q.queryType !== "topic_tag") return q.displayName;
  return q.displayName.startsWith("#") ? q.displayName : `#${q.displayName}`;
}

/** Active queries first, then soft-deleted ones tagged "Đã xoá" (text label, BR-017); API order kept within each group. */
export function toQueryFilterOptions(queries: readonly QueryLike[]): QueryFilterOptions {
  const sorted = [...queries.filter((q) => !q.deletedAt), ...queries.filter((q) => q.deletedAt)];
  return {
    items: sorted.map((q) => ({
      id: q.id,
      label: queryLabel(q),
      ...(q.deletedAt ? { supportingText: "Đã xoá" } : {}),
    })),
    names: Object.fromEntries(sorted.map((q) => [q.id, queryLabel(q)])),
  };
}

/**
 * Listening queries of the current project for the "Truy vấn" filter (FR-051, FR-130). Includes soft-deleted
 * queries so old drill-down links still resolve to a name. Shares the cache key with other callers, so the
 * filter bar and the keyword-share chart issue one request. MVP: only the first page (200) is loaded.
 */
export function useQueryFilterOptions(): QueryFilterOptions {
  const { project } = useCurrentProject();
  const pid = project?.id;
  // Same key, page shape and params as `useListeningQueries(pid, { includeDeleted: true })` (features may not
  // import each other), so the cache entry is shared.
  const { data } = useInfiniteQuery({
    queryKey: qk.queries(pid ?? "", { includeDeleted: true }),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      ListeningQueryPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/listening-queries`, {
          params: { includeDeleted: "true", limit: String(PAGE_SIZE), ...(pageParam ? { cursor: pageParam } : {}) },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: staleTimes.queries,
    enabled: !!pid,
  });
  return useMemo(() => toQueryFilterOptions(data?.pages.flatMap((p) => p.items) ?? []), [data]);
}
