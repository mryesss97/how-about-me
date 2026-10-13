"use client";

import {
  IntentsDistributionResponseSchema,
  OverviewResponseSchema,
  SafetyDistributionResponseSchema,
  SentimentResponseSchema,
  TimeseriesResponseSchema,
  TopicsDistributionResponseSchema,
} from "@how-about-me/contracts";
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

/** GET /projects/:projectId/analytics/mentions-timeseries (FR-135; `previous` per bucket when compare is on, FR-141). */
export function useMentionsTimeseries(pid: string | null | undefined, params: Record<string, string>) {
  return useQuery({
    queryKey: qk.timeseries(pid ?? "", params),
    queryFn: async () =>
      TimeseriesResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/analytics/mentions-timeseries`, { params }),
      ),
    staleTime: staleTimes.overview,
    enabled: !!pid,
  });
}

/** GET /projects/:projectId/analytics/sentiment (FR-136) — one request feeds both the donut and the stacked bars. */
export function useSentiment(pid: string | null | undefined, params: Record<string, string>) {
  return useQuery({
    queryKey: qk.distribution(pid ?? "", "sentiment", params),
    queryFn: async () =>
      SentimentResponseSchema.parse(await apiFetch<unknown>(`/projects/${pid}/analytics/sentiment`, { params })),
    staleTime: staleTimes.overview,
    enabled: !!pid,
  });
}

const DISTRIBUTIONS = {
  safety: SafetyDistributionResponseSchema,
  intents: IntentsDistributionResponseSchema,
  topics: TopicsDistributionResponseSchema,
} as const;

function useDistribution<K extends keyof typeof DISTRIBUTIONS>(
  kind: K,
  pid: string | null | undefined,
  params: Record<string, string>,
) {
  return useQuery({
    queryKey: qk.distribution(pid ?? "", kind, params),
    queryFn: async () =>
      DISTRIBUTIONS[kind].parse(
        await apiFetch<unknown>(`/projects/${pid}/analytics/${kind}`, { params }),
      ) as ReturnType<(typeof DISTRIBUTIONS)[K]["parse"]>,
    staleTime: staleTimes.overview,
    enabled: !!pid,
  });
}

/** GET /projects/:projectId/analytics/safety (FR-137). */
export const useSafetyDistribution = (pid: string | null | undefined, params: Record<string, string>) =>
  useDistribution("safety", pid, params);

/** GET /projects/:projectId/analytics/intents (FR-139) — every intent label, shares may sum past 100 %. */
export const useIntentsDistribution = (pid: string | null | undefined, params: Record<string, string>) =>
  useDistribution("intents", pid, params);

/** GET /projects/:projectId/analytics/topics (FR-138) — top 12 + "other". */
export const useTopicsDistribution = (pid: string | null | undefined, params: Record<string, string>) =>
  useDistribution("topics", pid, params);
