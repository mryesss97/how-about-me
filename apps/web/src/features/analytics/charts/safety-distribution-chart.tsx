"use client";

import type { SafetyDistributionResponse } from "@how-about-me/contracts";
import { SAFETY_LEVELS, type SafetyLevel } from "@how-about-me/taxonomy";
import { AlertOctagon, AlertTriangle, ShieldTick } from "@untitledui/icons";
import { useId } from "react";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { safetyBadge } from "@/lib/semantics/badges";
import { ChartCard, type DrillDownProps, drillSelect, segmentHref } from "./chart-card";
import { type BarRow, SAFETY_COLORS } from "./chart-data";
import { HorizontalBarChart } from "./horizontal-bar-chart";

export type SafetyDistributionChartProps = {
  data?: SafetyDistributionResponse;
  isLoading?: boolean;
  error?: QueryStateError | null;
  onRetry?: () => void;
  className?: string;
} & DrillDownProps<SafetyLevel>;

const ICONS = { ShieldTick, AlertTriangle, AlertOctagon } as const;

/** safe = solid, sensitive = diagonal stripes, severe = dense dots (NFR-030: pattern + icon, not colour only). */
export function safetyFill(level: SafetyLevel, idPrefix: string): string {
  return level === "safe" ? SAFETY_COLORS.safe : `url(#${idPrefix}-${level})`;
}

function SafetyPatterns({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <pattern
        id={`${idPrefix}-sensitive`}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill={SAFETY_COLORS.sensitive} opacity="0.35" />
        <rect width="3" height="6" fill={SAFETY_COLORS.sensitive} />
      </pattern>
      <pattern id={`${idPrefix}-severe`} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill={SAFETY_COLORS.severe} />
        <circle cx="2" cy="2" r="1" fill="white" opacity="0.6" />
      </pattern>
    </>
  );
}

/** Safety distribution (FR-137). safe + sensitive + severe = denominator (TC-DASH-014). Sentiment ≠ safety (BR-017). */
export function SafetyDistributionChart({
  data,
  isLoading,
  error,
  onRetry,
  className,
  getHref,
  onNavigate,
}: SafetyDistributionChartProps) {
  // useId returns ":r0:" — colons break url(#…) references.
  const idPrefix = `safety-${useId().replace(/:/g, "")}`;
  const denominator = data?.denominator ?? 0;
  const rows: BarRow<SafetyLevel>[] = SAFETY_LEVELS.map((key) => {
    const item = data?.distribution.find((d) => d.label === key);
    return { key, name: safetyBadge[key].label, count: item?.count ?? 0, share: item?.share ?? null };
  });

  const table = {
    rowHrefs: rows.map((r) => segmentHref(getHref, r)),
    columns: ["Level", "Count", "Share"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Total", formatCount(denominator), denominator > 0 ? formatRate(1) : "—"],
    ],
  };

  return (
    <ChartCard
      title="Safety distribution"
      description="Share of safety-analysed mentions"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      // BR-032: denominator 0 → empty state.
      isEmpty={!!data && denominator === 0}
      emptyTitle="No analysed mentions in this range"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={(r) => safetyFill(r.key, idPrefix)}
        denominator={denominator}
        onSelect={drillSelect({ getHref, onNavigate })}
        denominatorLabel="analysed"
        defs={<SafetyPatterns idPrefix={idPrefix} />}
      />
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {rows.map((r) => {
          const Icon = ICONS[safetyBadge[r.key].icon as keyof typeof ICONS];
          return (
            <li key={r.key} className="flex items-center gap-1.5 text-sm text-tertiary">
              <Icon
                aria-hidden
                data-icon={safetyBadge[r.key].icon}
                className="size-4"
                style={{ color: SAFETY_COLORS[r.key] }}
              />
              {r.name} · {formatRate(r.share)}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
