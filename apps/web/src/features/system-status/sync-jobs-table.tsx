"use client";

import Link from "next/link";
import { syncErrorLabel } from "@/lib/semantics/sync-errors";
import type { SyncJob } from "@how-about-me/contracts";
import { DASH, formatCount } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { formatLag, jobDurationSeconds, jobStatusLabel, jobTriggerLabel } from "./format";
import { StatusPlate } from "./status-plate";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm text-primary";

export type SyncJobsListProps = {
  items: SyncJob[];
  tz: string;
  queryNames: Map<string, string>;
  /** Query currently filtered on: its name is plain text (a link would go nowhere new). */
  currentQueryId: string;
  onOpen: (id: string) => void;
};

/** #343: jobs of one query (push, so Back returns to the unfiltered list). */
export const queryJobsHref = (queryId: string) => `/system-status?tab=sync-jobs&queryId=${queryId}`;

/** Query name cell: filter link unless already filtered on it; "Tất cả truy vấn" for global jobs. */
export function JobQueryName({
  job,
  queryNames,
  currentQueryId,
  className,
}: {
  job: SyncJob;
  queryNames: Map<string, string>;
  currentQueryId: string;
  className?: string;
}) {
  if (!job.queryId) return <>Tất cả truy vấn</>;
  const name = queryNames.get(job.queryId) ?? DASH;
  if (job.queryId === currentQueryId) return <>{name}</>;
  return (
    <Link
      href={queryJobsHref(job.queryId)}
      aria-label={`Xem các lượt đồng bộ của ${name}`}
      className={`text-brand-secondary hover:underline ${className ?? ""}`}
      // Keep the row's click / Enter handler from opening the drawer.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

/** Sync job list (FR-081, UX §3.6), `md`+ only (#343 cards below). Row click / Enter opens the detail drawer. */
export function SyncJobsTable({ items, tz, queryNames, currentQueryId, onOpen }: SyncJobsListProps) {
  return (
    <div className="operate-board hidden min-w-0 md:block">
      <span aria-hidden className="sign-keyline" />
      <div className="relative overflow-x-auto p-3">
        <table className="w-full">
          <thead className="border-b border-secondary bg-secondary">
            <tr>
              <th className={TH}>Bắt đầu</th>
              <th className={TH}>Truy vấn</th>
              <th className={TH}>Kích hoạt</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Trang</th>
              <th className={TH}>Đã lấy / Mới / Cập nhật</th>
              <th className={TH}>Thời lượng</th>
              <th className={TH}>Lỗi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((j) => (
              <tr
                key={j.id}
                tabIndex={0}
                data-job-id={j.id}
                aria-label={`Lượt đồng bộ ${formatDateTime(j.startedAt ?? j.createdAt, tz)}`}
                className="cursor-pointer border-b border-secondary hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-brand"
                onClick={() => onOpen(j.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(j.id);
                }}
              >
                <td className={`${TD} whitespace-nowrap`}>{formatDateTime(j.startedAt ?? j.createdAt, tz)}</td>
                <td className={TD}>
                  <JobQueryName job={j} queryNames={queryNames} currentQueryId={currentQueryId} />
                </td>
                <td className={TD}>{jobTriggerLabel[j.trigger]}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  <StatusPlate {...jobStatusLabel[j.status]} />
                </td>
                <td className={TD}>{formatCount(j.pagesFetched)}</td>
                <td className={`${TD} whitespace-nowrap`}>
                  {formatCount(j.recordsFetched)} / {formatCount(j.recordsInserted)} / {formatCount(j.recordsUpdated)}
                </td>
                <td className={`${TD} ${jobDurationSeconds(j.startedAt, j.completedAt) ? "" : "text-tertiary"}`}>
                  {formatLag(jobDurationSeconds(j.startedAt, j.completedAt))}
                </td>
                <td
                  className={`${TD} ${j.error ? "" : "text-tertiary"}`}
                  title={j.error ? `${j.error.code}: ${j.error.message}` : undefined}
                >
                  {j.error ? syncErrorLabel(j.error.code, j.error.message) : DASH}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
