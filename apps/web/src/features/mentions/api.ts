"use client";

import {
  BulkReanalyzeBodySchema,
  BulkReanalyzeResponseSchema,
  MentionsPageSchema,
  type BulkReanalyzeResponse,
} from "@how-about-me/contracts";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { flattenUnique, isRejectedCursor } from "@/lib/query/infinite-list";
import { qk, staleTimes } from "@/lib/query/keys";

export const MENTIONS_PAGE_SIZE = 25;

/**
 * GET /projects/:pid/mentions (FR-150..153). The cursor is opaque and lives in `pageParam` only — never in the
 * query key or the URL — so changing a filter resets the list. `count=true` only on the first page.
 */
export function useMentionsList(pid: string | null | undefined, params: Record<string, string>) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => qk.mentions(pid ?? "", params), [pid, params]);
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      MentionsPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/mentions`, {
          params: {
            ...params,
            limit: String(MENTIONS_PAGE_SIZE),
            ...(pageParam ? { cursor: pageParam } : { count: "true" }),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: staleTimes.mentions,
    enabled: !!pid,
  });
  const { fetchNextPage: fetchNext } = query;
  /**
   * The API rejects a stale or tampered cursor with 400 VALIDATION_ERROR on `cursor` (#195, e.g. a cursor issued
   * before a deploy). Load more then starts over from the first page instead of showing an error.
   */
  const fetchNextPage = useCallback(async () => {
    const res = await fetchNext();
    if (res.isFetchNextPageError && isRejectedCursor(res.error)) await qc.resetQueries({ queryKey, exact: true });
    return res;
  }, [fetchNext, qc, queryKey]);
  return { ...query, fetchNextPage };
}

export { flattenUnique, isRejectedCursor };

/**
 * POST /projects/:pid/mentions/reanalyze (T-146, FR-196). Body = the list's filters + `dryRun`; CSV params are
 * parsed into arrays by the shared schema. Admin only (server `@Roles("admin")`, FR-015). A real run invalidates
 * the list (analysis status badges) and overview (analysis-pending banner).
 */
export function useBulkReanalyze(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      params,
      dryRun,
    }: {
      params: Record<string, string>;
      dryRun: boolean;
    }): Promise<BulkReanalyzeResponse> => {
      const body = BulkReanalyzeBodySchema.parse({ ...params, dryRun });
      return BulkReanalyzeResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/mentions/reanalyze`, { method: "POST", body: JSON.stringify(body) }),
      );
    },
    onSuccess: (r, vars) => {
      if (vars.dryRun || r.enqueued === 0) return;
      void qc.invalidateQueries({ queryKey: ["project", pid, "mentions"] });
      void qc.invalidateQueries({ queryKey: ["project", pid, "analytics", "overview"] });
    },
  });
}
