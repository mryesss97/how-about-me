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
  defs,
}: {
  rows: readonly R[];
  getFill: (row: R) => string;
  denominator: number;
  denominatorLabel: string;
  /** SVG <defs> (e.g. hatch patterns referenced by getFill). */
  defs?: ReactNode;
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
                  denominator={denominator}
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
          >
            {data.map((r) => (
              <Cell key={r.key} fill={getFill(r)} />
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
