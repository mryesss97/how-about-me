"use client";

import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel, TopicLabel } from "@how-about-me/taxonomy";
import Link from "next/link";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard } from "./chart-card";
import { SENTIMENT_COLORS, SENTIMENT_ORDER, heatmapOpacity, humanizeLabel, shareOf } from "./chart-data";
import { MultiLabelNote } from "./horizontal-bar-chart";

type Row = TopicSentimentResponse["rows"][number];

export type TopicSentimentHeatmapProps = {
  data?: TopicSentimentResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
  /** FR-142: cell → `topic=t&sentiment=s`; `sentiment = null` drills the whole topic (table row header). */
  getCellHref?: (topic: TopicLabel, sentiment: SentimentLabel | null) => string | null;
};

/**
 * Topic × sentiment heatmap (FR-144, T-149). Rows = all taxonomy topics in API order, columns = sentiment.
 * Each cell prints "count · share within the row" (NFR-030: colour intensity is never the only cue); share
 * denominator = topic row total (posts with that topic and a sentiment). Non-zero cells are links (FR-142).
 */
export function TopicSentimentHeatmap({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getCellHref,
}: TopicSentimentHeatmapProps) {
  const rows = data?.rows ?? [];
  const table = {
    rowHrefs: rows.map((r) => (r.total > 0 ? (getCellHref?.(r.topic, null) ?? null) : null)),
    columns: ["Topic", "Positive", "Neutral", "Negative", "With sentiment", "Negative share"],
    rows: rows.map((r) => [
      humanizeLabel(r.topic),
      formatCount(r.positive),
      formatCount(r.neutral),
      formatCount(r.negative),
      formatCount(r.total),
      formatRate(r.negativeShare),
    ]),
  };

  return (
    <ChartCard
      title="Topic × sentiment"
      description="Distinct mentions per topic, share within each topic"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && rows.every((r) => r.total === 0)}
      emptyTitle="No analysed mentions in this range"
      table={table}
      className={className}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th scope="col" className="text-left text-xs font-medium text-tertiary">
                Topic
              </th>
              {SENTIMENT_ORDER.map((s) => (
                <th key={s} scope="col" className="text-xs font-medium text-tertiary">
                  {humanizeLabel(s)}
                </th>
              ))}
              <th scope="col" className="text-right text-xs font-medium text-tertiary">
                With sentiment
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.topic}>
                <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap text-secondary">
                  {humanizeLabel(r.topic)}
                </th>
                {SENTIMENT_ORDER.map((s) => (
                  <HeatmapCell key={s} row={r} sentiment={s} href={getCellHref} />
                ))}
                <td className="text-right text-tertiary tabular-nums">{formatCount(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MultiLabelNote noun="topics" />
    </ChartCard>
  );
}

function HeatmapCell({
  row,
  sentiment,
  href,
}: {
  row: Row;
  sentiment: SentimentLabel;
  href: TopicSentimentHeatmapProps["getCellHref"];
}) {
  const count = row[sentiment];
  const share = shareOf(count, row.total);
  const text = `${formatCount(count)} · ${formatRate(share)}`;
  const to = count > 0 ? (href?.(row.topic, sentiment) ?? null) : null;
  const label = `${humanizeLabel(row.topic)} · ${humanizeLabel(sentiment)}: ${formatCount(count)} mentions, ${formatRate(share)} of ${formatCount(row.total)} with sentiment`;
  return (
    <td className="relative h-9 min-w-24 rounded-md p-0 text-center tabular-nums">
      {/* Background layer: sentiment hue (never safety colours, BR-017) at an opacity set by the row share. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-md"
        style={{ backgroundColor: SENTIMENT_COLORS[sentiment], opacity: heatmapOpacity(share) }}
      />
      {to ? (
        <Link
          href={to}
          aria-label={label}
          title={label}
          className="relative flex h-full items-center justify-center rounded-md px-2 font-medium text-primary outline-focus-ring hover:underline focus-visible:outline-2"
        >
          {text}
        </Link>
      ) : (
        <span title={label} className="relative flex h-full items-center justify-center px-2 text-tertiary">
          {text}
        </span>
      )}
    </td>
  );
}
