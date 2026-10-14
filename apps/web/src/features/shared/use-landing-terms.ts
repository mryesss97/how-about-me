"use client";

import { LandingTermsResponseSchema } from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

const NO_PARAMS: Record<string, string> = {};

/**
 * GET /projects/:projectId/analytics/landing-terms (FR-149, BR-042, #261) — one row per configured landing term.
 * Empty `params` → server default (last 30 days, project timezone); use `data.range` to query the overview over the same range (#262).
 */
export function useLandingTerms(pid: string | null | undefined, params: Record<string, string> = NO_PARAMS) {
  return useQuery({
    queryKey: qk.landingTerms(pid ?? "", params),
    queryFn: async () =>
      LandingTermsResponseSchema.parse(await apiFetch<unknown>(`/projects/${pid}/analytics/landing-terms`, { params })),
    staleTime: staleTimes.overview,
    enabled: !!pid,
  });
}
