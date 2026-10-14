"use client";

import {
  DEFAULT_PHRASE_LIMIT,
  DEFAULT_PHRASE_MIN_MENTIONS,
  IntentsDistributionResponseSchema,
  PhraseSentimentResponseSchema,
  LanguagesDistributionResponseSchema,
  QueryShareResponseSchema,
  SafetyDistributionResponseSchema,
  SentimentResponseSchema,
  TimeseriesResponseSchema,
  TopicSentimentResponseSchema,
  TopicsDistributionResponseSchema,
} from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

export { useOverview } from "@/features/shared/use-overview";

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
  languages: LanguagesDistributionResponseSchema,
  "query-share": QueryShareResponseSchema,
  "topic-sentiment": TopicSentimentResponseSchema,
  phrases: PhraseSentimentResponseSchema,
} as const;

function useDistribution<K extends keyof typeof DISTRIBUTIONS>(
  kind: K,
  pid: string | null | undefined,
  params: Record<string, string>,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: qk.distribution(pid ?? "", kind, params),
    queryFn: async () =>
      DISTRIBUTIONS[kind].parse(
        await apiFetch<unknown>(`/projects/${pid}/analytics/${kind}`, { params }),
      ) as ReturnType<(typeof DISTRIBUTIONS)[K]["parse"]>,
    staleTime: staleTimes.overview,
    enabled: !!pid && (opts.enabled ?? true),
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

/** GET /projects/:projectId/analytics/languages (FR-143) — all 8 codes, count desc. */
export const useLanguagesDistribution = (pid: string | null | undefined, params: Record<string, string>) =>
  useDistribution("languages", pid, params);

/** GET /projects/:projectId/analytics/query-share (FR-145) — distinct mentions per query; counts overlap. */
export const useQueryShare = (pid: string | null | undefined, params: Record<string, string>) =>
  useDistribution("query-share", pid, params);

/** GET /projects/:projectId/analytics/topic-sentiment (FR-144) — one request feeds the heatmap and the contributors. */
export const useTopicSentiment = (pid: string | null | undefined, params: Record<string, string>) =>
  useDistribution("topic-sentiment", pid, params);

/**
 * GET /projects/:projectId/analytics/phrases (FR-148, BR-041) — top 30 phrases with ≥ 2 mentions. Only enabled in
 * the bubble map's Phrases mode (#243). `compare` is ignored by the API, so it is dropped to keep the key stable.
 */
export function usePhraseSentiment(
  pid: string | null | undefined,
  apiParams: Record<string, string>,
  opts: { enabled?: boolean } = {},
) {
  const params = useMemo(() => {
    const out: Record<string, string> = {
      ...apiParams,
      limit: String(DEFAULT_PHRASE_LIMIT),
      minMentions: String(DEFAULT_PHRASE_MIN_MENTIONS),
    };
    delete out.compare;
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  }, [apiParams]);
  return useDistribution("phrases", pid, params, opts);
}
