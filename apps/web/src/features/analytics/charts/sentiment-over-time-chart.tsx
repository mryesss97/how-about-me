"use client";

import type { SentimentResponse } from "@how-about-me/contracts";
import type { SentimentLabel } from "@how-about-me/taxonomy";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { selectEvenlySpacedItems } from "@/components/application/charts/charts-base";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount } from "@/lib/format/number";
import { sentimentBadge } from "@/lib/semantics/badges";
import { cx } from "@/utils/cx";
import { ChartCard } from "./chart-card";
import { SENTIMENT_COLORS, SENTIMENT_ORDER, type SentimentStackRow, shareOf, toSentimentStackRows } from "./chart-data";
import { MetricTooltip } from "./metric-tooltip";

const MAX_TICKS = 8;

export type SentimentOverTimeChartProps = {
  data?: SentimentResponse;
  /** Bucketing tz — the response has none, so use the filter tz the backend bucketed with. */
  timezone: string;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
};

/** Sentiment over time, stacked bars (FR-136). No ghost series: the contract has no previous-period data. */
export function SentimentOverTimeChart({
  data,
  timezone,
  isLoading,
  error,
  onRetry,
  className,
}: SentimentOverTimeChartProps) {
  const rows = useMemo(() => toSentimentStackRows(data?.timeseries, timezone), [data, timezone]);
  const [hidden, setHidden] = useState<ReadonlySet<SentimentLabel>>(new Set());
  const ticks = selectEvenlySpacedItems(rows, Math.min(MAX_TICKS, rows.length)).map((r) => r.label);
  const toggle = (key: SentimentLabel) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const table = {
    columns: ["Thời gian", ...SENTIMENT_ORDER.map((k) => sentimentBadge[k].label), "Tổng"],
    rows: rows.map((r) => [r.label, ...SENTIMENT_ORDER.map((k) => formatCount(r[k])), formatCount(r.total)]),
  };

  return (
    <ChartCard
      title="Cảm xúc theo thời gian"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && rows.every((r) => r.total === 0)}
      emptyTitle="Chưa có lượt nhắc đã phân tích trong khoảng này"
      table={table}
      className={className}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
            <XAxis dataKey="label" ticks={ticks} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip
              cursor={{ fillOpacity: 0.06 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as SentimentStackRow | undefined;
                if (!active || !row) return null;
                return (
                  <MetricTooltip
                    title={row.label}
                    lines={SENTIMENT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({
                      name: sentimentBadge[k].label,
                      count: row[k],
                      share: shareOf(row[k], row.total),
                      color: SENTIMENT_COLORS[k],
                    }))}
                    denominator={row.total}
                    denominatorLabel="lượt nhắc đã phân tích"
                  />
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              content={() => (
                <ul className="flex -translate-y-2 justify-end gap-3">
                  {SENTIMENT_ORDER.map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        aria-pressed={!hidden.has(k)}
                        onClick={() => toggle(k)}
                        className={cx(
                          "flex items-center gap-2 text-sm text-tertiary outline-focus-ring focus-visible:outline-2",
                          hidden.has(k) && "line-through opacity-50",
                        )}
                      >
                        <span className="size-2 rounded-full" style={{ background: SENTIMENT_COLORS[k] }} />
                        {sentimentBadge[k].label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            />
            {SENTIMENT_ORDER.map((k) => (
              <Bar
                key={k}
                name={sentimentBadge[k].label}
                dataKey={k}
                stackId="s"
                hide={hidden.has(k)}
                fill={SENTIMENT_COLORS[k]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
