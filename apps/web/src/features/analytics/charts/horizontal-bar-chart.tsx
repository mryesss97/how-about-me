"use client";

import type { ComponentProps, ReactNode } from "react";
import { Bar, BarChart, Cell, LabelList, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount, formatRate } from "@/lib/format/number";
import type { BarRow } from "./chart-data";
import { MetricTooltip } from "./metric-tooltip";

const ROW_HEIGHT = 28;

/** "120 · 12.0%" — value printed next to each bar so colour is never the only cue (NFR-030). */
export const barValueLabel = (row: BarRow) => `${formatCount(row.count)} · ${formatRate(row.share)}`;

/** Shared horizontal bar chart for T-101 distributions (internal; not exported via index). */
export function HorizontalBarChart<R extends BarRow>({
  rows,
  getFill,
  denominator,
  denominatorLabel,
  rowDenominator,
  defs,
  onSelect,
}: {
  rows: readonly R[];
  getFill: (row: R) => string;
  denominator: number;
  denominatorLabel: string;
  /** Per-row denominator for the tooltip (e.g. topic row total, FR-144); falls back to `denominator`. */
  rowDenominator?: (row: R) => number;
  /** SVG <defs> (e.g. hatch patterns referenced by getFill). */
  defs?: ReactNode;
  /** FR-142 drill-down on bar click; rows for which it returns false are not clickable. */
  onSelect?: { canSelect: (row: R) => boolean; select: (row: R) => void };
}) {
  const data = rows.map((r) => ({ ...r, valueLabel: barValueLabel(r) }));
  return (
    <div className="w-full" style={{ height: Math.max(rows.length * ROW_HEIGHT + 24, 120) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 96, top: 0, bottom: 0 }}>
          {defs ? <defs>{defs}</defs> : null}
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "var(--color-bg-secondary)" }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as R | undefined;
              if (!active || !r) return null;
              return (
                <MetricTooltip
                  title={r.name}
                  lines={[{ name: r.name, count: r.count, share: r.share }]}
                  denominator={rowDenominator?.(r) ?? denominator}
                  denominatorLabel={denominatorLabel}
                />
              );
            }}
          />
          {/* A custom shape keeps zero-count rows (Recharts drops zero-width default bars), so their
              "0 · 0.0%" label still renders (TC-DASH-016: all intents incl. zero counts). */}
          <Bar
            dataKey="count"
            isAnimationActive={false}
            radius={[0, 4, 4, 0]}
            shape={(props: ComponentProps<typeof Rectangle>) => <Rectangle {...props} />}
            onClick={(_entry: unknown, index: number) => {
              const row = rows[index];
              if (row && onSelect?.canSelect(row)) onSelect.select(row);
            }}
          >
            {data.map((r, i) => (
              <Cell key={r.key} fill={getFill(r)} cursor={onSelect?.canSelect(rows[i] as R) ? "pointer" : undefined} />
            ))}
            <LabelList dataKey="valueLabel" position="right" fill="var(--color-text-tertiary)" className="text-xs" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Multi-label note (FR-138/139): shares are not normalised. */
export function MultiLabelNote({ noun }: { noun: string }) {
  return (
    <p className="text-xs text-tertiary">{`A mention can have several ${noun}, so shares can add up to more than 100%.`}</p>
  );
}
