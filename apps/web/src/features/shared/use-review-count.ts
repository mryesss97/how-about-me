"use client";

import { ReviewQueuePageSchema } from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

/** #345: same filter as the default "Tất cả" tab of /reviews (FR-195). */
export const REVIEW_COUNT_PARAMS = { status: "unreviewed", limit: "1", count: "true" } as const;

/**
 * Unreviewed items for the sidebar plate (#345, FR-195). `null` = unknown (counts timed out) → hide, never "0"
 * (BR-032). Only enable for roles that see the plate (admin/analyst).
 */
export function useReviewCount(pid: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.reviewCount(pid ?? ""),
    queryFn: async () =>
      ReviewQueuePageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/reviews`, { params: { ...REVIEW_COUNT_PARAMS } }),
      ),
    select: (p): number | null => p.counts?.all ?? null,
    staleTime: staleTimes.reviewCount,
    enabled: !!pid && enabled,
  });
}
