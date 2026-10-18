"use client";

import type { TopicSentimentResponse } from "@how-about-me/contracts";
import type { TopicLabel } from "@how-about-me/taxonomy";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, segmentHref } from "./chart-card";
import { SENTIMENT_COLORS, toContributorRows } from "./chart-data";
import { HorizontalBarChart } from "./horizontal-bar-chart";

export type NegativeTopicsChartProps = {
  data?: TopicSentimentResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<TopicLabel>;

export const NEGATIVE_SHARE_NOTE = "Tỷ lệ = tiêu cực ÷ bài nhắc có cảm xúc của chủ đề này.";

/**
 * Negative-topic contributors (FR-144, T-149): topics with negative mentions ranked by negative count, label
 * "count · negativeShare" where the denominator is the topic row (posts with that topic and a sentiment).
 * Drill-down → `topic=X&sentiment=negative` (FR-142).
 */
export function NegativeTopicsChart({ data, isLoading, error, onRetry, className, getHref }: NegativeTopicsChartProps) {
  const rows = toContributorRows(data?.rows ?? []);
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Chủ đề", "Tiêu cực", "Có cảm xúc", "Tỷ lệ tiêu cực"],
    rows: rows.map((r) => [r.name, formatCount(r.count), formatCount(r.total), formatRate(r.share)]),
  };

  return (
    <ChartCard
      title="Chủ đề kéo tiêu cực"
      description="Chủ đề xếp theo số bài nhắc tiêu cực"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && rows.length === 0}
      emptyTitle="Không có bài nhắc tiêu cực trong khoảng này"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={() => SENTIMENT_COLORS.negative}
        denominator={0}
        rowDenominator={(r) => r.total}
        denominatorLabel="bài nhắc có cảm xúc trong chủ đề này"
        getRowHref={(r) => segmentHref(getHref, r)}
      />
      <p className="text-xs text-tertiary">{NEGATIVE_SHARE_NOTE}</p>
    </ChartCard>
  );
}
