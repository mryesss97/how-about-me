"use client";

import { OverviewResponseSchema } from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

/**
 * GET /projects/:projectId/analytics/overview (FR-132..134).
 * `params` must come from `useFilters().apiParams` — memoised with `now` floored to the minute, so the key is stable.
 */
export function useOverview(pid: string | null | undefined, params: Record<string, string>) {
  return useQuery({
    queryKey: qk.overview(pid ?? "", params),
    queryFn: async () =>
      OverviewResponseSchema.parse(await apiFetch<unknown>(`/projects/${pid}/analytics/overview`, { params })),
    staleTime: staleTimes.overview,
    enabled: !!pid,
  });
}
