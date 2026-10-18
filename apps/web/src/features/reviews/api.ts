"use client";

import {
  MarkReviewedBodySchema,
  MarkReviewedResponseSchema,
  ReviewQueuePageSchema,
  type ReviewQueuePage,
  type ReviewReason,
  type ReviewStatus,
  type UserRole,
} from "@how-about-me/contracts";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { formatCount } from "@/lib/format/number";
import { isRejectedCursor } from "@/lib/query/infinite-list";
import { ApiError, apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

export const REVIEWS_PAGE_SIZE = 25;

export type ReviewFilters = { reason?: ReviewReason; status: ReviewStatus };

/** Builds the query params for one page; `count=true` only on the first page (tab badges). */
export function reviewQueueParams(filters: ReviewFilters, cursor: string | null): Record<string, string> {
  return {
    ...(filters.reason ? { reason: filters.reason } : {}),
    status: filters.status,
    limit: String(REVIEWS_PAGE_SIZE),
    ...(cursor ? { cursor } : { count: "true" }),
  };
}

/** GET /projects/:pid/reviews (FR-195). Cursor in `pageParam` only; a rejected cursor restarts the list (#195). */
export function useReviewQueue(pid: string | null | undefined, filters: ReviewFilters) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => qk.reviews(pid ?? "", filters), [pid, filters]);
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      ReviewQueuePageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/reviews`, { params: reviewQueueParams(filters, pageParam) }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: staleTimes.reviews,
    enabled: !!pid,
  });
  const { fetchNextPage: fetchNext } = query;
  const fetchNextPage = useCallback(async () => {
    const res = await fetchNext();
    if (res.isFetchNextPageError && isRejectedCursor(res.error)) await qc.resetQueries({ queryKey, exact: true });
    return res;
  }, [fetchNext, qc, queryKey]);
  return { ...query, fetchNextPage };
}

/** FR-195 / FR-015: admin and analyst mark items; viewer reads only. UX gating — the server enforces `@Roles`. */
export const canMarkReviewed = (role: UserRole | null) => role === "admin" || role === "analyst";

/**
 * Optimistic removal of marked ids from one cached queue: drops the rows and decrements `counts` per reason
 * (and `totalCount`) of each removed row. Absent counts (timed out) stay absent.
 */
export function removeFromQueue(
  data: InfiniteData<ReviewQueuePage> | undefined,
  ids: ReadonlySet<string>,
): InfiniteData<ReviewQueuePage> | undefined {
  if (!data) return data;
  const removed = data.pages.flatMap((p) => p.items.filter((i) => ids.has(i.id)));
  if (removed.length === 0) return data;
  const dec = (n: number, by: number) => Math.max(0, n - by);
  const byReason = (r: ReviewReason) => removed.filter((i) => i.reasons.includes(r)).length;
  const pages = data.pages.map((p, idx) => {
    const items = p.items.filter((i) => !ids.has(i.id));
    if (idx !== 0) return { ...p, items };
    return {
      ...p,
      items,
      totalCount: p.totalCount == null ? p.totalCount : dec(p.totalCount, removed.length),
      counts: p.counts && {
        all: dec(p.counts.all, removed.length),
        uncertain: dec(p.counts.uncertain, byReason("uncertain")),
        lowConfidence: dec(p.counts.lowConfidence, byReason("low_confidence")),
        failed: dec(p.counts.failed, byReason("failed")),
      },
    };
  });
  return { ...data, pages };
}

const isUnreviewedKey = (key: QueryKey) => {
  const f = key[3] as Partial<ReviewFilters> | undefined;
  return f?.status !== "reviewed";
};

/**
 * POST /projects/:pid/reviews/mark-reviewed (FR-195, BR-040). Optimistically removes the rows from every cached
 * unreviewed queue; rolls back on error; always re-syncs reviews, mentions (`reviewStatus` filter)
 * and mention detail (`review`, #339).
 */
export function useMarkReviewed(pid: string | null | undefined) {
  const qc = useQueryClient();
  const p = pid ?? "";
  return useMutation({
    mutationFn: async (postIds: string[]) => {
      if (!pid) throw new Error("Chưa chọn dự án");
      const body = MarkReviewedBodySchema.parse({ postIds });
      return MarkReviewedResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/reviews/mark-reviewed`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
    onMutate: async (postIds) => {
      await qc.cancelQueries({ queryKey: ["project", p, "reviews"] });
      const snapshot = qc.getQueriesData<InfiniteData<ReviewQueuePage>>({ queryKey: ["project", p, "reviews"] });
      const ids = new Set(postIds);
      for (const [key, data] of snapshot) if (isUnreviewedKey(key)) qc.setQueryData(key, removeFromQueue(data, ids));
      return { snapshot };
    },
    onSuccess: (r, postIds) => {
      const skipped = postIds.length - r.marked;
      // Ids gone from the project (or no longer in scope) are skipped server-side; the refetch restores truth.
      const done = `Đã đánh dấu ${formatCount(r.marked)} mục đã xem lại`;
      toast.success(skipped > 0 ? `${done} (bỏ qua ${formatCount(skipped)})` : done);
    },
    onError: (err: unknown, _ids, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
      const msg = err instanceof ApiError ? err.message : "Không thể đánh dấu đã xem lại";
      toast.error(msg, {
        description: err instanceof ApiError && err.requestId ? `Mã yêu cầu: ${err.requestId}` : undefined,
      });
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["project", p, "reviews"] }),
        qc.invalidateQueries({ queryKey: ["project", p, "mentions"] }),
        // #339: mention detail carries `review.status` (BR-040).
        qc.invalidateQueries({ queryKey: ["project", p, "mention"] }),
      ]),
  });
}
