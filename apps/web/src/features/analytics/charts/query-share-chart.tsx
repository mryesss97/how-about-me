"use client";

import type { QueryShareResponse } from "@how-about-me/contracts";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
import type { BarRow } from "./chart-data";
import { HorizontalBarChart } from "./horizontal-bar-chart";

export type QueryShareChartProps = {
  data?: QueryShareResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<string>;

export const OVERLAP_NOTE =
  "A mention can match several queries, so it is counted once under each query and shares can add up to more than 100%.";

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
  getHref,
  onNavigate,
}: QueryShareChartProps) {
  const denominator = data?.denominator ?? 0;
  const rows: BarRow[] = (data?.distribution ?? []).map((d) => ({
    key: d.queryId,
    name: d.displayName,
    count: d.count,
    share: d.share,
  }));
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Query", "Count", "Share"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Distinct mentions", formatCount(denominator), "—"],
    ],
  };

  return (
    <ChartCard
      title="Keyword share"
      description="Distinct mentions per query"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && denominator === 0}
      emptyTitle="No mentions in this range"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={() => "var(--color-utility-brand-500)"}
        denominator={denominator}
        onSelect={drillSelect({ getHref, onNavigate })}
        denominatorLabel="mentions"
      />
      <p className="text-xs text-tertiary">{OVERLAP_NOTE}</p>
    </ChartCard>
  );
}
