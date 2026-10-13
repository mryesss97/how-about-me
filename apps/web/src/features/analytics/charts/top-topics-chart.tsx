"use client";

import type { TopicsDistributionResponse } from "@how-about-me/contracts";
import type { TopicLabel } from "@how-about-me/taxonomy";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
import { sumShares, toBarRows } from "./chart-data";
import { HorizontalBarChart, MultiLabelNote } from "./horizontal-bar-chart";

export type TopTopicsChartProps = {
  data?: TopicsDistributionResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<TopicLabel>;

/** Top topics (FR-138): top 12 by distinct mentions + "Other" last. No summed Total — multi-label (TC-DASH-015). */
export function TopTopicsChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
  onNavigate,
}: TopTopicsChartProps) {
  const denominator = data?.denominator ?? 0;
  const rows = toBarRows(data?.distribution ?? []);
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Topic", "Count", "Share"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Mentions with a topic", formatCount(denominator), "—"],
    ],
  };

  return (
    <ChartCard
      title="Top topics"
      description="Top 12 topics by distinct mentions"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && (denominator === 0 || rows.length === 0)}
      emptyTitle="No analysed mentions in this range"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={(r) => (r.key === "other" ? "var(--color-utility-neutral-400)" : "var(--color-utility-brand-500)")}
        denominator={denominator}
        onSelect={drillSelect({ getHref, onNavigate })}
        denominatorLabel="with a topic"
      />
      {sumShares(rows) > 1 ? <MultiLabelNote noun="topics" /> : null}
    </ChartCard>
  );
}
