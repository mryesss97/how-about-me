"use client";

import { ListeningQueryPageSchema } from "@how-about-me/contracts";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { isRejectedCursor } from "@/lib/query/infinite-list";
import { qk, staleTimes } from "@/lib/query/keys";

export const QUERIES_PAGE_SIZE = 200;

/** GET /projects/:pid/listening-queries (FR-051). Soft-deleted queries are hidden unless `includeDeleted`. */
export function useListeningQueries(pid: string | null | undefined, opts: { includeDeleted: boolean }) {
  const qc = useQueryClient();
  const { includeDeleted } = opts;
  const queryKey = useMemo(() => qk.queries(pid ?? "", { includeDeleted }), [pid, includeDeleted]);
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      ListeningQueryPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/listening-queries`, {
          params: {
            includeDeleted: String(includeDeleted),
            limit: String(QUERIES_PAGE_SIZE),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: staleTimes.queries,
    enabled: !!pid,
  });
  const { fetchNextPage: fetchNext } = query;
  // A stale/tampered cursor (400 on `cursor`, #195) restarts from the first page, same as Mentions.
  const fetchNextPage = useCallback(async () => {
    const res = await fetchNext();
    if (res.isFetchNextPageError && isRejectedCursor(res.error)) await qc.resetQueries({ queryKey, exact: true });
    return res;
  }, [fetchNext, qc, queryKey]);
  return { ...query, fetchNextPage };
}
