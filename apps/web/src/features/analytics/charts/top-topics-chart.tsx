"use client";

import { displayLabel } from "@/lib/semantics/labels";
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
  const rows = toBarRows(data?.distribution ?? [], (k) => displayLabel("topic", k));
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Chủ đề", "Số lượng", "Tỷ lệ"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Lượt nhắc có chủ đề", formatCount(denominator), "—"],
    ],
  };

  return (
    <ChartCard
      title="Chủ đề nổi bật"
      description="12 chủ đề có nhiều lượt nhắc nhất"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && (denominator === 0 || rows.length === 0)}
      emptyTitle="Chưa có lượt nhắc đã phân tích trong khoảng này"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={(r) => (r.key === "other" ? "var(--color-utility-neutral-400)" : "var(--color-utility-brand-500)")}
        denominator={denominator}
        onSelect={drillSelect({ getHref, onNavigate })}
        denominatorLabel="lượt nhắc có chủ đề"
      />
      {sumShares(rows) > 1 ? <MultiLabelNote noun="chủ đề" /> : null}
    </ChartCard>
  );
}
