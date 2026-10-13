"use client";

import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { TopicLabel } from "@how-about-me/taxonomy";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
import { SENTIMENT_COLORS, toContributorRows } from "./chart-data";
import { HorizontalBarChart } from "./horizontal-bar-chart";

export type NegativeTopicsChartProps = {
  data?: TopicSentimentResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<TopicLabel>;

export const NEGATIVE_SHARE_NOTE = "Share = negative ÷ mentions of this topic with a sentiment.";

/**
 * Negative-topic contributors (FR-144, T-149): topics with negative mentions ranked by negative count, label
 * "count · negativeShare" where the denominator is the topic row (posts with that topic and a sentiment).
 * Drill-down → `topic=X&sentiment=negative` (FR-142).
 */
export function NegativeTopicsChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
  onNavigate,
}: NegativeTopicsChartProps) {
  const rows = toContributorRows(data?.rows ?? []);
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Topic", "Negative", "With sentiment", "Negative share"],
    rows: rows.map((r) => [r.name, formatCount(r.count), formatCount(r.total), formatRate(r.share)]),
  };

  return (
    <ChartCard
      title="Negative-topic contributors"
      description="Topics ranked by negative mentions"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && rows.length === 0}
      emptyTitle="No negative mentions in this range"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={() => SENTIMENT_COLORS.negative}
        denominator={0}
        rowDenominator={(r) => r.total}
        denominatorLabel="with sentiment in this topic"
        onSelect={drillSelect({ getHref, onNavigate })}
      />
      <p className="text-xs text-tertiary">{NEGATIVE_SHARE_NOTE}</p>
    </ChartCard>
  );
}
