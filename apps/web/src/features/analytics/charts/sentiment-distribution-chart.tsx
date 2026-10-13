"use client";

import type { SentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel } from "@how-about-me/taxonomy";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
import { SENTIMENT_COLORS, SENTIMENT_ORDER } from "./chart-data";
import { MetricTooltip } from "./metric-tooltip";

export type SentimentDistributionChartProps = {
  data?: SentimentResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<SentimentLabel>;

type Slice = { key: SentimentLabel; name: string; count: number; share: number | null };

/** Sentiment donut (FR-136). Centre = denominator (analysed mentions); table totals equal it (TC-DASH-013). */
export function SentimentDistributionChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
  onNavigate,
}: SentimentDistributionChartProps) {
  const denominator = data?.denominator ?? 0;
  const slices: Slice[] = SENTIMENT_ORDER.map((key) => {
    const item = data?.distribution.find((d) => d.label === key);
    return { key, name: sentimentBadge[key].label, count: item?.count ?? 0, share: item?.share ?? null };
  });

  const select = drillSelect({ getHref, onNavigate });
  const table = {
    rowHrefs: slices.map((s) => segmentHref(getHref, s)),
    columns: ["Sentiment", "Count", "Share"],
    rows: [
      ...slices.map((s) => [s.name, formatCount(s.count), formatRate(s.share)]),
      ["Total", formatCount(denominator), denominator > 0 ? formatRate(1) : "—"],
    ],
  };

  return (
    <ChartCard
      title="Sentiment distribution"
      description="Share of analysed mentions"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      // Denominator 0 → empty state, no division by zero (BR-032).
      isEmpty={!!data && denominator === 0}
      emptyTitle="No analysed mentions in this range"
      table={table}
      className={className}
    >
      <div className="relative h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                const s = payload?.[0]?.payload as Slice | undefined;
                if (!active || !s) return null;
                return (
                  <MetricTooltip
                    title={s.name}
                    lines={[{ name: s.name, count: s.count, share: s.share, color: SENTIMENT_COLORS[s.key] }]}
                    denominator={denominator}
                    denominatorLabel="analysed"
                  />
                );
              }}
            />
            <Pie
              data={slices}
              dataKey="count"
              nameKey="name"
              innerRadius="60%"
              outerRadius="85%"
              stroke="none"
              isAnimationActive={false}
              onClick={(_entry: unknown, index: number) => {
                const s = slices[index];
                if (s && select?.canSelect(s)) select.select(s);
              }}
            >
              {slices.map((s) => (
                <Cell
                  key={s.key}
                  fill={SENTIMENT_COLORS[s.key]}
                  cursor={select?.canSelect(s) ? "pointer" : undefined}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-2rem)] flex flex-col items-center">
          <span className="text-display-xs font-semibold text-primary">{formatCount(denominator)}</span>
          <span className="text-xs text-tertiary">analysed</span>
        </div>
      </div>
      {/* Static legend in sentiment order: colour is never the only cue (label + share as text, NFR-030). */}
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm text-tertiary">
            <span aria-hidden className="size-2 rounded-full" style={{ background: SENTIMENT_COLORS[s.key] }} />
            {s.name} · {formatRate(s.share)}
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
