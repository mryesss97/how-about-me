"use client";

import { formatCount, formatRate } from "@/lib/format/number";

export type TooltipLine = { name: string; count: number; share: number | null; color?: string };

/**
 * Shared chart tooltip body (FR-140): every line shows count + share, and the denominator is always named.
 * `previous` adds the compare-period line (FR-141).
 */
export function MetricTooltip({
  title,
  lines,
  denominator,
  denominatorLabel = "lượt nhắc",
  previous,
}: {
  title: string;
  lines: readonly TooltipLine[];
  denominator: number;
  denominatorLabel?: string;
  previous?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-primary-solid px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-white">{title}</p>
      {lines.map((l) => (
        <p key={l.name} className="flex items-center gap-1.5 text-xs text-tooltip-supporting-text">
          {l.color ? <span aria-hidden className="size-2 rounded-full" style={{ background: l.color }} /> : null}
          {`${l.name}: ${formatCount(l.count)} (${formatRate(l.share)})`}
        </p>
      ))}
      <p className="text-xs text-tooltip-supporting-text">{`trên ${formatCount(denominator)} ${denominatorLabel}`}</p>
      {previous !== undefined ? (
        <p className="text-xs text-tooltip-supporting-text">{`Kỳ trước: ${formatCount(previous)}`}</p>
      ) : null}
    </div>
  );
}
