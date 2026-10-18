"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatCount, formatRate } from "@/lib/format/number";
import type { BarRow } from "./chart-data";

/** "120 · 12,0%" — value printed next to each bar so colour is never the only cue (NFR-030). */
export const barValueLabel = (row: BarRow) => `${formatCount(row.count)} · ${formatRate(row.share)}`;

export const ROW_DRILL_HINT = "Xem bài nhắc";

const ROW_CLASS =
  "grid min-h-11 grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] items-center gap-3 rounded-[3px] px-2 text-xs md:min-h-9";

/**
 * Shared horizontal bar list for distributions (internal; not exported via index). #335: rendered as HTML rows,
 * not Recharts, so each drillable row is a real full-width link (≥44px tall on mobile, 36px desktop, FR-142).
 */
export function HorizontalBarChart<R extends BarRow>({
  rows,
  getFill,
  denominator,
  denominatorLabel,
  rowDenominator,
  defs,
  getRowHref,
}: {
  rows: readonly R[];
  getFill: (row: R) => string;
  denominator: number;
  denominatorLabel: string;
  /** Per-row denominator (e.g. topic row total, FR-144); printed on the row instead of the shared footer line. */
  rowDenominator?: (row: R) => number;
  /** SVG <defs> (e.g. hatch patterns referenced by getFill). */
  defs?: ReactNode;
  /** FR-142 drill-down href per row; null = plain row (zero count, topic "other"). */
  getRowHref?: (row: R) => string | null;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex w-full flex-col gap-2">
      {defs ? (
        <svg aria-hidden width="0" height="0" className="absolute">
          <defs>{defs}</defs>
        </svg>
      ) : null}
      <ul className="flex flex-col">
        {rows.map((r) => {
          const href = getRowHref?.(r) ?? null;
          const value = barValueLabel(r);
          const sub = rowDenominator ? ` trên ${formatCount(rowDenominator(r))}` : "";
          // Zero-count rows keep their row with an empty bar (TC-DASH-016).
          const body = (
            <>
              <span className="truncate text-secondary" title={r.name}>
                {r.name}
              </span>
              <svg aria-hidden width="100%" height="10" className="block">
                <rect width={`${(r.count / max) * 100}%`} height="10" rx="2" fill={getFill(r)} />
              </svg>
              <span className="text-right whitespace-nowrap text-tertiary tabular-nums">
                {value}
                {sub ? <span className="hidden sm:inline">{sub}</span> : null}
              </span>
            </>
          );
          return (
            <li key={r.key}>
              {href ? (
                <Link
                  href={href}
                  aria-label={`${r.name}: ${value}${sub} — ${ROW_DRILL_HINT}`}
                  className={`${ROW_CLASS} outline-focus-ring hover:bg-secondary focus-visible:outline-2`}
                >
                  {body}
                </Link>
              ) : (
                <div className={ROW_CLASS}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {rowDenominator ? null : (
        <p className="text-xs text-tertiary">{`trên ${formatCount(denominator)} ${denominatorLabel}`}</p>
      )}
    </div>
  );
}

/** Multi-label note (FR-138/139): shares are not normalised. */
export function MultiLabelNote({ noun }: { noun: string }) {
  return (
    <p className="text-xs text-tertiary">{`Một lượt nhắc có thể thuộc nhiều ${noun}, nên tổng tỷ lệ có thể vượt 100%.`}</p>
  );
}
