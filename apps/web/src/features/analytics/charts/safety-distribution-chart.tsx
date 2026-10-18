"use client";

import type { SafetyDistributionResponse } from "@how-about-me/contracts";
import { SAFETY_LEVELS, type SafetyLevel } from "@how-about-me/taxonomy";
import { AlertOctagon, AlertTriangle, ShieldTick } from "@untitledui/icons";
import { useId } from "react";
import type { QueryStateError } from "@/features/shared/query-state";
import { formatCount, formatRate } from "@/lib/format/number";
import { safetyBadge } from "@/lib/semantics/badges";
import { ChartCard, type DrillDownProps, segmentHref } from "./chart-card";
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
    columns: ["Mức độ", "Số lượng", "Tỷ lệ"],
    rows: [
      ...rows.map((r) => [r.name, formatCount(r.count), formatRate(r.share)]),
      ["Tổng", formatCount(denominator), denominator > 0 ? formatRate(1) : "—"],
    ],
  };

  return (
    <ChartCard
      title="Phân bố an toàn"
      description="Tỷ lệ trên bài nhắc đã đánh giá an toàn"
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      // BR-032: denominator 0 → empty state.
      isEmpty={!!data && denominator === 0}
      emptyTitle="Chưa có bài nhắc đã phân tích trong khoảng này"
      table={table}
      className={className}
    >
      <HorizontalBarChart
        rows={rows}
        getFill={(r) => safetyFill(r.key, idPrefix)}
        denominator={denominator}
        getRowHref={(r) => segmentHref(getHref, r)}
        denominatorLabel="bài nhắc đã phân tích"
        defs={<SafetyPatterns idPrefix={idPrefix} />}
        // #387 / NFR-030: icon + word + value + pattern on each row; no separate legend.
        renderLabelPrefix={(r) => {
          const Icon = ICONS[safetyBadge[r.key].icon as keyof typeof ICONS];
          return (
            <Icon
              aria-hidden
              data-icon={safetyBadge[r.key].icon}
              className="size-4 shrink-0"
              style={{ color: SAFETY_COLORS[r.key] }}
            />
          );
        }}
      />
    </ChartCard>
  );
}
