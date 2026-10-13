"use client";

import type { IntentsDistributionResponse } from "@how-about-me/contracts";
import type { IntentLabel } from "@how-about-me/taxonomy";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
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
  onNavigate,
}: IntentDistributionChartProps) {
  const denominator = data?.denominator ?? 0;
  const rows = toBarRows(data?.distribution ?? []);
  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Intent", "Count", "Share"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Mentions with an intent", formatCount(denominator), "—"],
    ],
  };

  return (
    <ChartCard
      title="Intent distribution"
      description="Distinct mentions per intent"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && denominator === 0}
      emptyTitle="No analysed mentions in this range"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={(r) => (r.key === "other" ? "var(--color-utility-neutral-400)" : "var(--color-utility-brand-500)")}
        denominator={denominator}
        onSelect={drillSelect({ getHref, onNavigate })}
        denominatorLabel="with an intent"
      />
      {sumShares(rows) > 1 ? <MultiLabelNote noun="intents" /> : null}
    </ChartCard>
  );
}
