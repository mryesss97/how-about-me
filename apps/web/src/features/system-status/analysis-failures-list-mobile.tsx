"use client";

import { PlaqueButton } from "@/features/shared/plaque-button";
import { formatCount } from "@/lib/format/number";
import { analysisErrorLabel } from "@/lib/semantics/sync-errors";
import { formatDateTime } from "@/lib/time/format";
import { FailurePostLink, shortExcerpt } from "./analysis-failure-post";
import { errorTitle, type FailuresListProps } from "./analysis-failures-table";
import { analysisTriggerLabel } from "./format";

/** #343 (ops-8/ops-11): failed analysis runs as cards below `md`; admin gets a full-width "Thử lại" (FR-015 UX). */
export function AnalysisFailuresListMobile({ items, tz, isAdmin, busyIds, onRetry }: FailuresListProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {items.map((r) => (
        <li
          key={r.id}
          data-testid={`failure-card-${r.id}`}
          className="rounded-lg border border-secondary bg-primary p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-error-primary" title={errorTitle(r)}>
              {r.errorCode ? analysisErrorLabel(r.errorCode) : "Lỗi"}
            </span>
            <span className="text-xs text-tertiary tabular-nums">
              {formatDateTime(r.completedAt ?? r.createdAt, tz)}
            </span>
          </div>
          <FailurePostLink run={r} className="min-h-11 justify-center py-1" />
          <p className="text-xs text-tertiary">
            Lần thử {formatCount(r.attemptCount)} · {analysisTriggerLabel[r.trigger]}
          </p>
          {isAdmin ? (
            <PlaqueButton
              className="mt-3 min-h-11 w-full justify-center"
              aria-label={`Thử lại phân tích bài "${shortExcerpt(r)}"`}
              isLoading={busyIds.has(r.id)}
              isDisabled={busyIds.has(r.id)}
              onClick={() => onRetry(r.id)}
            >
              Thử lại
            </PlaqueButton>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
