"use client";

import { analysisErrorLabel } from "@/lib/semantics/sync-errors";
import type { AnalysisRun } from "@how-about-me/contracts";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { DASH, formatCount } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { FailurePostLink, shortExcerpt } from "./analysis-failure-post";
import { analysisTriggerLabel } from "./format";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm text-primary";

export type FailuresListProps = {
  items: AnalysisRun[];
  tz: string;
  isAdmin: boolean;
  busyIds: ReadonlySet<string>;
  onRetry: (id: string) => void;
};

export const errorTitle = (r: AnalysisRun) =>
  r.errorCode ? `${r.errorCode}${r.errorMessage ? `: ${r.errorMessage}` : ""}` : undefined;

/**
 * Failed analysis runs (FR-175, UX §3.6), `md`+ only (#343 cards below). Version moved to the time cell's title;
 * the error shows its label only (code in the title). "Thử lại" is admin-only UX; the server enforces FR-015.
 */
export function AnalysisFailuresTable({ items, tz, isAdmin, busyIds, onRetry }: FailuresListProps) {
  return (
    <div className="operate-board hidden min-w-0 md:block">
      <span aria-hidden className="sign-keyline" />
      <div className="relative overflow-x-auto p-3">
        <table className="w-full">
          <thead className="border-b border-secondary bg-secondary">
            <tr>
              <th className={TH}>Thời gian</th>
              <th className={TH}>Lỗi</th>
              <th className={TH}>Bài viết</th>
              <th className={TH}>Số lần thử</th>
              <th className={TH}>Kích hoạt</th>
              {isAdmin ? (
                <th className={TH}>
                  <span className="sr-only">Thao tác</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} data-run-id={r.id} className="border-b border-secondary">
                <td className={`${TD} whitespace-nowrap`} title={r.effectiveVersion}>
                  {formatDateTime(r.completedAt ?? r.createdAt, tz)}
                </td>
                <td className={TD} title={errorTitle(r)}>
                  {r.errorCode ? (
                    <span className="font-semibold text-error-primary">{analysisErrorLabel(r.errorCode)}</span>
                  ) : (
                    DASH
                  )}
                </td>
                <td className={`${TD} max-w-sm`}>
                  <FailurePostLink run={r} />
                </td>
                <td className={TD}>{formatCount(r.attemptCount)}</td>
                <td className={`${TD} whitespace-nowrap`}>{analysisTriggerLabel[r.trigger]}</td>
                {isAdmin ? (
                  <td className={TD}>
                    <PlaqueButton
                      className="whitespace-nowrap"
                      aria-label={`Thử lại phân tích bài "${shortExcerpt(r)}"`}
                      isLoading={busyIds.has(r.id)}
                      isDisabled={busyIds.has(r.id)}
                      onClick={() => onRetry(r.id)}
                    >
                      Thử lại
                    </PlaqueButton>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
