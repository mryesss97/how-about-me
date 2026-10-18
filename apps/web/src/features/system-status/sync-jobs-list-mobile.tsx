"use client";

import { formatCount } from "@/lib/format/number";
import { syncErrorLabel } from "@/lib/semantics/sync-errors";
import { formatDateTime } from "@/lib/time/format";
import { formatLag, jobDurationSeconds, jobStatusLabel, jobTriggerLabel } from "./format";
import { StatusPlate } from "./status-plate";
import { JobQueryName, type SyncJobsListProps } from "./sync-jobs-table";

/**
 * #343 (ops-8): sync jobs as row cards below `md`. The whole card opens the drawer via a stretched button placed
 * first in the DOM; the query link sits above it (`relative z-10`) so nothing interactive is nested.
 */
export function SyncJobsListMobile({ items, tz, queryNames, currentQueryId, onOpen }: SyncJobsListProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {items.map((j) => {
        const time = formatDateTime(j.startedAt ?? j.createdAt, tz);
        const duration = jobDurationSeconds(j.startedAt, j.completedAt);
        return (
          <li
            key={j.id}
            data-testid={`job-card-${j.id}`}
            className="relative rounded-lg border border-secondary bg-primary p-4 focus-within:ring-2 focus-within:ring-brand"
          >
            <button
              type="button"
              aria-label={`Lượt đồng bộ ${time} — xem chi tiết`}
              className="absolute inset-0 rounded-lg outline-hidden"
              onClick={() => onOpen(j.id)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <StatusPlate {...jobStatusLabel[j.status]} />
              <span className="text-sm text-primary tabular-nums">{time}</span>
              <span className="text-xs text-tertiary">{jobTriggerLabel[j.trigger]}</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-primary">
              <JobQueryName
                job={j}
                queryNames={queryNames}
                currentQueryId={currentQueryId}
                className="relative z-10 inline-flex min-h-11 items-center py-2"
              />
            </div>
            <p className="text-sm text-secondary tabular-nums">
              {formatCount(j.recordsFetched)} lấy · {formatCount(j.recordsInserted)} mới ·{" "}
              {formatCount(j.recordsUpdated)} cập nhật{duration ? ` · ${formatLag(duration)}` : ""}
            </p>
            {j.error ? (
              <p className="mt-1 text-sm text-error-primary">{syncErrorLabel(j.error.code, j.error.message)}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
