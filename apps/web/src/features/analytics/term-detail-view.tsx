"use client";

import type { SentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel } from "@how-about-me/taxonomy";
import { type ReactNode, useCallback, useMemo } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { appliedChips } from "@/lib/filters/api-params";
import { bucketDrillDown, bucketSentimentDrillDown, segmentDrillDown } from "@/lib/filters/drill-down";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import type { Filters } from "@/lib/filters/schema";
import { useFilters } from "@/lib/filters/use-filters";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { useMentionsTimeseries, useSentiment, useTopicsDistribution } from "./api";
import { MentionsOverTimeChart, SentimentDistributionChart, SentimentOverTimeChart, TopTopicsChart } from "./charts";
import { termDetailCopy as copy } from "./copy";
import { FilterBar } from "./filter-bar";
import { previousWindow, termChange } from "./term-compare";
import { TermHero, TermSiblings } from "./term-hero";
import { TimePresets } from "./time-controls";
import { toQueryError } from "./query-error";
import { useOverviewDrillDown } from "./use-overview-drill-down";

type Sentiment = "positive" | "neutral" | "negative";
/** Solid enamel when one sentiment clearly leads — same rule as the landing boards (#271). */
const SOLID_SHARE = 0.6;

/** Split of a phrase from the sentiment distribution: its denominator is what the landing board counts (BR-042). */
export function termSplit(data: SentimentResponse | undefined) {
  const count = (k: Sentiment) => data?.distribution.find((d) => d.label === k)?.count ?? 0;
  const counts = { positive: count("positive"), neutral: count("neutral"), negative: count("negative") };
  const total = data?.denominator ?? 0;
  // Tie: negative > positive > neutral, like the boards.
  const dominant = (["negative", "positive", "neutral"] as const).reduce((a, b) => (counts[b] > counts[a] ? b : a));
  const share = total > 0 ? counts[dominant] / total : 0;
  const tone =
    total === 0
      ? "blank"
      : dominant === "neutral"
        ? "neutral"
        : `${dominant}-${share >= SOLID_SHARE ? "solid" : "mixed"}`;
  return { counts, total, dominant, share, tone };
}

const HERO_KEYS = ["from", "relevance", "term", "timezone", "to"] as const;
const THIRTY_DAYS_MS = 30 * 864e5;

/**
 * #333 entry-1: hero params = range + timezone + relevance (BR-016) + term (BR-042) only — enum filters, queryIds,
 * phrase and compare never change the hero. Same sorted keys as `toApiParams`, so without filters it shares the cache.
 */
export function heroParams(live: Record<string, string>, term: string): Record<string, string> {
  const src: Record<string, string> = { ...live, term };
  return Object.fromEntries(HERO_KEYS.filter((k) => src[k] != null).map((k) => [k, src[k] as string]));
}

/** Labels of the active non-default filters the hero ignores (relevance and term stay in the hero). */
export function activeListFilters(filters: Filters): string[] {
  return appliedChips(filters)
    .filter((c) => c.key !== "relevance" && c.key !== "term")
    .map((c) => c.label);
}

/**
 * Phrase detail (#276, #333): hero (unfiltered answer) → mentions with sentiment tabs → filters → charts. Every
 * request carries `term` (BR-042). 0 posts and no filter → one empty state (hero + range + one action).
 */
export interface TermListSlotProps {
  counts: { positive: number; neutral: number; negative: number } | null;
  total: number | null;
}

/** `renderList` puts the mentions board under the hero (composed in the route; features never import each other). */
export function TermDetailView({
  term,
  renderList,
}: {
  term: string;
  renderList?: (p: TermListSlotProps) => ReactNode;
}) {
  const { project } = useCurrentProject();
  const { filters, setFilters, apiParams: live } = useFilters("analytics");
  const apiParams = useMemo(() => {
    const { compare: _compare, ...rest } = live;
    return { ...rest, term };
  }, [live, term]);
  const termFilters = useMemo(() => ({ ...filters, term }), [filters, term]);
  const { href, navigate } = useOverviewDrillDown(termFilters, apiParams);
  const pid = project?.id;
  const loadingProject = !project;
  const hParams = useMemo(() => heroParams(live, term), [live, term]);
  const prevParams = useMemo(
    () => (hParams.from && hParams.to ? { ...hParams, ...previousWindow(hParams.from, hParams.to) } : hParams),
    [hParams],
  );
  const hero = useSentiment(pid, hParams);
  const previous = useSentiment(pid, prevParams);
  const sentiment = useSentiment(pid, apiParams);
  const timeseries = useMentionsTimeseries(pid, apiParams);
  const topics = useTopicsDistribution(pid, apiParams);
  const split = termSplit(hero.data);
  // FR-142 (#335): both time charts drill by bucket (+ sentiment); `href` keeps `term` via termFilters.
  const { from, to } = live;
  const mentionTimes = useMemo(() => timeseries.data?.data.map((p) => p.time) ?? [], [timeseries.data]);
  const sentimentTimes = useMemo(() => sentiment.data?.timeseries?.data.map((p) => p.time) ?? [], [sentiment.data]);
  const bucketHref = useCallback(
    (i: number) => (from && to ? href(bucketDrillDown(mentionTimes, i, { from, to })) : null),
    [href, mentionTimes, from, to],
  );
  const sentimentHref = useCallback(
    (i: number, k: SentimentLabel | null) =>
      from && to ? href(bucketSentimentDrillDown(sentimentTimes, i, { from, to }, k)) : null,
    [href, sentimentTimes, from, to],
  );
  const prevSplit = previous.data ? termSplit(previous.data) : null;
  const change = prevSplit
    ? termChange(
        { total: split.total, negative: split.counts.negative },
        { total: prevSplit.total, negative: prevSplit.counts.negative },
      )
    : null;
  const filteredLabels = activeListFilters(filters);
  const range = { from: hParams.from ?? "", to: hParams.to ?? "", timezone: hParams.timezone ?? DEFAULT_TZ };
  const empty = !!hero.data && split.total === 0 && filteredLabels.length === 0;
  const short = Date.parse(range.to) - Date.parse(range.from) < THIRTY_DAYS_MS - 60_000;

  const heroBlock = (
    <>
      <TermHero
        term={term}
        filters={filters}
        split={split}
        loaded={!!hero.data}
        change={change}
        filteredLabels={filteredLabels}
      />
      <TermSiblings pid={pid} term={term} filters={filters} range={range} />
    </>
  );

  if (empty) {
    // #333 entry-10: one empty state — range control plus exactly one action.
    return (
      <div className="flex flex-col gap-6">
        {heroBlock}
        <div className="flex flex-wrap items-center gap-3">
          <TimePresets filters={filters} setFilters={setFilters} />
          {filters.preset !== "30d" && short ? (
            <PlaqueButton onClick={() => setFilters({ preset: "30d", from: null, to: null })}>
              {copy.widenTo30d}
            </PlaqueButton>
          ) : (
            <PlaqueButton href="/">{copy.home}</PlaqueButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {heroBlock}
      {renderList?.({ counts: hero.data ? split.counts : null, total: hero.data ? split.total : null })}

      <FilterBar shareLink />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <MentionsOverTimeChart
          getBucketHref={bucketHref}
          onNavigate={navigate}
          className="lg:col-span-8"
          data={timeseries.data}
          isLoading={loadingProject || timeseries.isLoading}
          error={toQueryError(timeseries.error)}
          onRetry={() => void timeseries.refetch()}
        />
        <SentimentDistributionChart
          getHref={(k) => href(segmentDrillDown("sentiment", k))}
          onNavigate={navigate}
          className="lg:col-span-4"
          data={sentiment.data}
          isLoading={loadingProject || sentiment.isLoading}
          error={toQueryError(sentiment.error)}
          onRetry={() => void sentiment.refetch()}
        />
        <SentimentOverTimeChart
          getSegmentHref={sentimentHref}
          onNavigate={navigate}
          className="lg:col-span-6"
          data={sentiment.data}
          timezone={live.timezone ?? DEFAULT_TZ}
          isLoading={loadingProject || sentiment.isLoading}
          error={toQueryError(sentiment.error)}
          onRetry={() => void sentiment.refetch()}
        />
        <TopTopicsChart
          getHref={(k) => href(segmentDrillDown("topic", k))}
          onNavigate={navigate}
          className="lg:col-span-6"
          data={topics.data}
          isLoading={loadingProject || topics.isLoading}
          error={toQueryError(topics.error)}
          onRetry={() => void topics.refetch()}
        />
      </div>
    </div>
  );
}
