"use client";

import type { LanguagesDistributionResponse } from "@how-about-me/contracts";
import type { LanguageCode } from "@how-about-me/taxonomy";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
import { LANGUAGE_COLORS, LANGUAGE_NAMES } from "./chart-data";
import { MetricTooltip } from "./metric-tooltip";

export type LanguageDistributionChartProps = {
  data?: LanguagesDistributionResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<LanguageCode>;

type Slice = { key: LanguageCode; name: string; count: number; share: number | null };

/**
 * Language donut (FR-143, T-148). Centre = denominator (posts with a language, `unknown` included);
 * the table lists all 8 codes in API order (count desc) and its Total equals the denominator (TC-DASH-027).
 */
export function LanguageDistributionChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
  onNavigate,
}: LanguageDistributionChartProps) {
  const denominator = data?.denominator ?? 0;
  const rows: Slice[] = (data?.distribution ?? []).map((d) => ({
    key: d.label,
    name: LANGUAGE_NAMES[d.label],
    count: d.count,
    share: d.share,
  }));
  // Zero-count codes stay in the table but are dropped from the donut and legend.
  const slices = rows.filter((s) => s.count > 0);

  const select = drillSelect({ getHref, onNavigate });
  const table = {
    rowHrefs: rows.map((s) => segmentHref(getHref, s)),
    columns: ["Ngôn ngữ", "Số lượng", "Tỷ lệ"],
    rows: [
      ...rows.map((s) => [s.name, formatCount(s.count), formatRate(s.share)]),
      ["Tổng", formatCount(denominator), denominator > 0 ? formatRate(1) : "—"],
    ],
  };

  return (
    <ChartCard
      title="Phân bố ngôn ngữ"
      description="Tỷ lệ trên lượt nhắc đã nhận diện ngôn ngữ"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      // Denominator 0 → empty state, no division by zero (BR-032).
      isEmpty={!!data && denominator === 0}
      emptyTitle="Chưa có lượt nhắc nhận diện được ngôn ngữ trong khoảng này"
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
                    lines={[{ name: s.name, count: s.count, share: s.share, color: LANGUAGE_COLORS[s.key] }]}
                    denominator={denominator}
                    denominatorLabel="lượt nhắc có ngôn ngữ"
                    drillable={!!select?.canSelect(s)}
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
                <Cell key={s.key} fill={LANGUAGE_COLORS[s.key]} cursor={select?.canSelect(s) ? "pointer" : undefined} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-2rem)] flex flex-col items-center">
          <span className="text-display-xs font-semibold text-primary">{formatCount(denominator)}</span>
          <span className="text-xs text-tertiary">có ngôn ngữ</span>
        </div>
      </div>
      {/* Colour is never the only cue: label + share as text (NFR-030). */}
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm text-tertiary">
            <span aria-hidden className="size-2 rounded-full" style={{ background: LANGUAGE_COLORS[s.key] }} />
            {s.name} · {formatRate(s.share)}
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
