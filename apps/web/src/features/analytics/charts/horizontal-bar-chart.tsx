"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatCount, formatRate } from "@/lib/format/number";
import type { BarRow } from "./chart-data";

/** "120 · 12,0%" — value printed next to each bar so colour is never the only cue (NFR-030). */
export const barValueLabel = (row: BarRow) => `${formatCount(row.count)} · ${formatRate(row.share)}`;

export const ROW_DRILL_HINT = "Xem bài nhắc";

/**
 * #387, BR-017: container-query layout. Narrow cards (<420px) stack each row — label + value on line 1, a full-width
 * 8px bar on line 2 — so small shares stay visible with their pattern. Wide cards keep the single-line grid.
 * Rows stay ≥44px on narrow cards at every breakpoint (FR-142).
 */
const ROW_CLASS =
  "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[3px] px-2 py-1.5 text-xs @[420px]:grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] @[420px]:gap-y-0 @[420px]:py-0 @[420px]:md:min-h-9";

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
  renderLabelPrefix,
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
  /** Optional node before the label (e.g. safety icon, #387 / NFR-030). */
  renderLabelPrefix?: (row: R) => ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="@container flex w-full flex-col gap-2">
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
              <span className="flex min-w-0 items-center gap-1.5 text-secondary">
                {renderLabelPrefix?.(r)}
                <span className="truncate" title={r.name}>
                  {r.name}
                </span>
              </span>
              <span className="text-right whitespace-nowrap text-tertiary tabular-nums @[420px]:col-start-3">
                {value}
                {sub ? <span className="hidden @[420px]:inline">{sub}</span> : null}
              </span>
              {/* DOM order label → value → bar; wide cards place the bar back in column 2 (#387). */}
              <svg
                aria-hidden
                width="100%"
                className="col-span-2 block h-2 @[420px]:col-span-1 @[420px]:col-start-2 @[420px]:row-start-1 @[420px]:h-2.5"
              >
                <rect width={`${(r.count / max) * 100}%`} height="100%" rx="2" fill={getFill(r)} />
              </svg>
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
