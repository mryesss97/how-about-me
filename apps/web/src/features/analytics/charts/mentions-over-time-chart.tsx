"use client";

import type { TimeseriesResponse } from "@how-about-me/contracts";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegendContent, selectEvenlySpacedItems } from "@/components/application/charts/charts-base";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount } from "@/lib/format/number";
import { tzOffsetLabel } from "@/lib/time/format";
import { ChartCard } from "./chart-card";
import { type MentionsRow, hasPrevious, shareOf, toMentionsRows } from "./chart-data";
import { MetricTooltip } from "./metric-tooltip";

const MAX_TICKS = 8;

export type MentionsOverTimeChartProps = {
  data?: TimeseriesResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
  /** FR-142: drill-down href for bucket `index` (null = not drillable). */
  getBucketHref?: (index: number) => string | null;
  onNavigate?: (href: string) => void;
};

/** Mentions over time (FR-135) with a dashed "Previous period" ghost series when compare is on (FR-141, TC-DASH-017). */
export function MentionsOverTimeChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getBucketHref,
  onNavigate,
}: MentionsOverTimeChartProps) {
  const rows = useMemo(() => (data ? toMentionsRows(data) : []), [data]);
  const withPrevious = hasPrevious(rows);
  // Tooltip share denominator = all mentions in the selected range (decision 2026-10-13).
  const total = rows.reduce((sum, r) => sum + r.mentions, 0);
  const ticks = selectEvenlySpacedItems(rows, Math.min(MAX_TICKS, rows.length)).map((r) => r.label);

  // Empty buckets are not drillable, same as zero-count segments.
  const bucketHref = (i: number) => ((rows[i]?.mentions ?? 0) > 0 ? (getBucketHref?.(i) ?? null) : null);
  const drillable = !!getBucketHref && !!onNavigate;
  const table = {
    rowHrefs: rows.map((_, i) => bucketHref(i)),
    columns: withPrevious ? ["Thời gian", "Bài nhắc", "Kỳ trước"] : ["Thời gian", "Bài nhắc"],
    rows: rows.map((r) => {
      const cells = [r.label, formatCount(r.mentions)];
      return withPrevious ? [...cells, r.previous === undefined ? "—" : formatCount(r.previous)] : cells;
    }),
  };

  return (
    <ChartCard
      title="Bài nhắc theo thời gian"
      description={
        data ? `Gom theo ${data.interval === "hour" ? "giờ" : "ngày"} · ${tzOffsetLabel(data.timezone)}` : undefined
      }
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!!data && total === 0 && !withPrevious}
      table={table}
      className={className}
    >
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            style={drillable ? { cursor: "pointer" } : undefined}
            onClick={(state: { activeTooltipIndex?: number | string | null } | null) => {
              const index = Number(state?.activeTooltipIndex);
              const href = Number.isInteger(index) ? bucketHref(index) : null;
              if (href && onNavigate) onNavigate(href);
            }}
          >
            <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-neutral-100" />
            <XAxis dataKey="label" ticks={ticks} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as MentionsRow | undefined;
                if (!active || !row) return null;
                return (
                  <MetricTooltip
                    title={row.label}
                    lines={[{ name: "Bài nhắc", count: row.mentions, share: shareOf(row.mentions, total) }]}
                    denominator={total}
                    previous={row.previous}
                    drillable={drillable && bucketHref(rows.indexOf(row)) !== null}
                  />
                );
              }}
            />
            <Legend verticalAlign="top" align="right" content={<ChartLegendContent className="-translate-y-2" />} />
            <Area
              name="Bài nhắc"
              dataKey="mentions"
              type="monotone"
              stroke="var(--color-utility-brand-600)"
              fill="var(--color-utility-brand-600)"
              fillOpacity={0.12}
              strokeWidth={2}
              className="text-utility-brand-600"
              isAnimationActive={false}
            />
            {withPrevious ? (
              <Line
                name="Kỳ trước"
                dataKey="previous"
                type="monotone"
                stroke="var(--color-utility-neutral-400)"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                dot={false}
                activeDot={false}
                className="text-utility-neutral-400"
                isAnimationActive={false}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
