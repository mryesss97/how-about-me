"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toMentionsHref } from "@/lib/filters/api-params";
import { type DrillKpiId, kpiDrillDown } from "@/lib/filters/drill-down";
import type { Filters } from "@/lib/filters/schema";
import type { useFilters } from "@/lib/filters/use-filters";

export type OverviewApiParams = ReturnType<typeof useFilters>["apiParams"];
export type DrillHref = (extra: Partial<Filters> | null) => string | null;

/** Drill-down helpers for /overview (FR-142). */
export function useOverviewDrillDown(filters: Filters, apiParams: OverviewApiParams) {
  const router = useRouter();
  // FR-142 drill-down: pin the exact range sent to analytics (not a fresh "now"), so the list matches the counts.
  const queriedTo = apiParams.to;
  const href = useCallback<DrillHref>(
    (extra) => (extra ? toMentionsHref(filters, extra, new Date(queriedTo ?? Date.now())) : null),
    [filters, queriedTo],
  );
  const navigate = useCallback((to: string) => router.push(to), [router]);
  const kpiHref = useCallback((id: DrillKpiId) => href(kpiDrillDown(id)) ?? "/mentions", [href]);
  return { href, navigate, kpiHref };
}
