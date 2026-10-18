"use client";

import type { SentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel } from "@how-about-me/taxonomy";
import { ArrowLeft, ArrowRight } from "@untitledui/icons";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { toMentionsHref } from "@/lib/filters/api-params";
import { bucketDrillDown, bucketSentimentDrillDown, segmentDrillDown } from "@/lib/filters/drill-down";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { useFilters } from "@/lib/filters/use-filters";
import { formatCount, formatRate } from "@/lib/format/number";
import { useMentionsTimeseries, useSentiment, useTopicsDistribution } from "./api";
import { MentionsOverTimeChart, SentimentDistributionChart, SentimentOverTimeChart, TopTopicsChart } from "./charts";
import { termDetailCopy as copy } from "./copy";
import { FilterBar } from "./filter-bar";
import { toQueryError } from "./query-error";
import { useOverviewDrillDown } from "./use-overview-drill-down";

type Sentiment = "positive" | "neutral" | "negative";
const ORDER: Sentiment[] = ["positive", "neutral", "negative"];
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

/**
 * Phrase detail (#276): the phrase as a large enamel board (dominant sentiment, split, count equal to the landing
 * board), then mentions over time, sentiment split and over time, and top topics — every request carries `term`
 * (BR-042, #273). Range and other filters come from the URL (the landing links with the last 30 days).
 */
export function TermDetailView({ term }: { term: string }) {
  const { project } = useCurrentProject();
  const { filters, apiParams: live } = useFilters("analytics");
  const apiParams = useMemo(() => {
    const { compare: _compare, ...rest } = live;
    return { ...rest, term };
  }, [live, term]);
  const termFilters = useMemo(() => ({ ...filters, term }), [filters, term]);
  const { href, navigate } = useOverviewDrillDown(termFilters, apiParams);
  const pid = project?.id;
  const loadingProject = !project;
  const sentiment = useSentiment(pid, apiParams);
  const timeseries = useMentionsTimeseries(pid, apiParams);
  const topics = useTopicsDistribution(pid, apiParams);
  const split = termSplit(sentiment.data);
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

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="term-title" data-tone={split.tone} className="sign-board term-hero">
        <span aria-hidden className="sign-keyline" />
        <div className="relative flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="term-hero-link">
              <ArrowLeft aria-hidden className="size-4" />
              {copy.back}
            </Link>
            {/* #331 / FR-142: pin the page range + filters so Mentions shows the same post set. */}
            <Link href={toMentionsHref(termFilters)} className="term-hero-link">
              {copy.allMentions}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <h1 id="term-title" className="term-hero-phrase">
            &quot;{term}&quot;
          </h1>
          {sentiment.data ? (
            split.total > 0 ? (
              <>
                <p className="term-hero-figure">
                  {formatRate(split.share)} {copy.sentiment[split.dominant]} ·{" "}
                  {copy.withSentiment(formatCount(split.total))} · {copy.period(filters)}
                </p>
                <div className="term-split">
                  <p className="sr-only">{copy.splitLabel}</p>
                  <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-[2px]">
                    {ORDER.map((k) => (
                      <span
                        key={k}
                        className={`term-split-${k}`}
                        style={{ width: `${(split.counts[k] / split.total) * 100}%` }}
                      />
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-3">
                    {ORDER.map((k) => (
                      <div key={k} className="flex flex-col">
                        <dt className="text-xs font-medium text-secondary">{copy.sentiment[k]}</dt>
                        <dd className="term-split-figure">
                          {formatRate(split.counts[k] / split.total)}
                          <span className="ml-1.5 text-xs font-medium text-tertiary">
                            ({formatCount(split.counts[k])})
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            ) : (
              <p className="term-hero-figure">{copy.none}</p>
            )
          ) : (
            <p className="term-hero-figure opacity-50">—</p>
          )}
          <p className="max-w-[70ch] text-xs">{copy.matchNote}</p>
        </div>
      </section>

      <FilterBar />

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
