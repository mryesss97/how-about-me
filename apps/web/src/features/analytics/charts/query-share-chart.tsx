"use client";

import type { QueryShareResponse } from "@how-about-me/contracts";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, segmentHref } from "./chart-card";
import type { BarRow } from "./chart-data";
import { HorizontalBarChart } from "./horizontal-bar-chart";

export type QueryShareChartProps = {
  data?: QueryShareResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
  /** id → display label (tags as `#name`, #329); falls back to the API `displayName`. */
  queryNames?: Record<string, string>;
} & DrillDownProps<string>;

export const OVERLAP_NOTE =
  "Một bài nhắc có thể khớp nhiều truy vấn, nên được tính một lần cho mỗi truy vấn và tổng tỷ lệ có thể vượt 100%.";

/**
 * Keyword share (FR-145, T-150): distinct mentions per listening query, API order (count desc). Overlap is allowed
 * (FR-147), so there is no summed Total — the table ends with the distinct-mentions denominator instead.
 */
export function QueryShareChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  queryNames,
  getHref,
}: QueryShareChartProps) {
  const denominator = data?.denominator ?? 0;
  const rows: BarRow[] = (data?.distribution ?? []).map((d) => ({
    key: d.queryId,
    name: queryNames?.[d.queryId] ?? d.displayName,
    count: d.count,
    share: d.share,
  }));
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Truy vấn", "Số lượng", "Tỷ lệ"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Bài nhắc (không trùng)", formatCount(denominator), "—"],
    ],
  };

  return (
    <ChartCard
      title="Tỷ trọng từ khoá"
      description="Bài nhắc theo từng truy vấn"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && denominator === 0}
      emptyTitle="Không có bài nhắc trong khoảng này"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={() => "var(--color-utility-brand-500)"}
        denominator={denominator}
        getRowHref={(r) => segmentHref(getHref, r)}
        denominatorLabel="bài nhắc"
      />
      <p className="text-xs text-tertiary">{OVERLAP_NOTE}</p>
    </ChartCard>
  );
}
