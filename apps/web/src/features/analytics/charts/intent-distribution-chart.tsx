"use client";

import { displayLabel } from "@/lib/semantics/labels";
import type { IntentsDistributionResponse } from "@how-about-me/contracts";
import type { IntentLabel } from "@how-about-me/taxonomy";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, segmentHref } from "./chart-card";
import { sumShares, toBarRows } from "./chart-data";
import { HorizontalBarChart, MultiLabelNote } from "./horizontal-bar-chart";

export type IntentDistributionChartProps = {
  data?: IntentsDistributionResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<IntentLabel>;

/** Intent distribution (FR-139): every label incl. zero counts, API order; shares may exceed 100% (TC-DASH-016). */
export function IntentDistributionChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
}: IntentDistributionChartProps) {
  const denominator = data?.denominator ?? 0;
  const rows = toBarRows(data?.distribution ?? [], (k) => displayLabel("intent", k));
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Ý định", "Số lượng", "Tỷ lệ"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Bài nhắc có ý định", formatCount(denominator), "—"],
    ],
  };

  return (
    <ChartCard
      title="Phân bố ý định"
      description="Bài nhắc theo từng ý định"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && denominator === 0}
      emptyTitle="Chưa có bài nhắc đã phân tích trong khoảng này"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={(r) => (r.key === "other" ? "var(--color-utility-neutral-400)" : "var(--color-utility-brand-500)")}
        denominator={denominator}
        getRowHref={(r) => segmentHref(getHref, r)}
        denominatorLabel="bài nhắc có ý định"
      />
      {sumShares(rows) > 1 ? <MultiLabelNote noun="ý định" /> : null}
    </ChartCard>
  );
}
