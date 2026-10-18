"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/base/buttons/button";
import { syncErrorLabel } from "@/lib/semantics/sync-errors";
import { formatDateTime } from "@/lib/time/format";
import { useBackfillJobProgress, useInvalidateQueryList } from "./api";
import { isTerminal, jobStatusLabel, progressSummary } from "./backfill-form";
import { jobHref, mentionsHref, mentionsWindowHref } from "./format";

type Props = { pid: string; jobId: string; alreadyRunning: boolean; onClose: () => void };

/** Progress step: polls the sync job (3 s) until terminal. Closing the dialog stops polling; the job keeps running. */
export function BackfillProgress({ pid, jobId, alreadyRunning, onClose }: Props) {
  const { data: job, error } = useBackfillJobProgress(pid, jobId);
  const invalidateList = useInvalidateQueryList(pid);
  const done = !!job && isTerminal(job.status);

  // Refresh "Lần đồng bộ cuối" once the job ends.
  useEffect(() => {
    if (done) invalidateList();
  }, [done, invalidateList]);

  return (
    <>
      {alreadyRunning ? (
        <p role="status" className="text-sm text-warning-primary">
          Truy vấn đang đồng bộ. Đang theo dõi lượt đồng bộ hiện tại.
        </p>
      ) : null}
      {error ? <p className="text-sm text-error-primary">Không tải được tiến độ.</p> : null}
      {job ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-secondary">
            Trạng thái: <strong data-testid="backfill-status">{jobStatusLabel[job.status]}</strong>
          </p>
          {!done ? (
            <div
              role="progressbar"
              aria-label="Tiến độ lấy dữ liệu cũ"
              className="h-2 w-full overflow-hidden rounded-full bg-quaternary"
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-solid" />
            </div>
          ) : null}
          <dl className="grid grid-cols-4 gap-2 text-sm">
            {progressSummary(job).map((s) => (
              <div key={s.label} className="flex flex-col">
                <dt className="text-tertiary">{s.label}</dt>
                <dd className="font-medium text-primary">{s.value.toLocaleString("vi-VN")}</dd>
              </div>
            ))}
          </dl>
          {job.windowSince && job.windowUntil ? (
            <p className="text-sm text-tertiary">
              Khoảng: {formatDateTime(job.windowSince)} – {formatDateTime(job.windowUntil)}
            </p>
          ) : null}
          {job.error ? (
            <p className="text-sm text-error-primary" title={`${job.error.code}: ${job.error.message}`}>
              {syncErrorLabel(job.error.code, job.error.message)}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={jobHref(jobId)} className="text-sm font-semibold text-brand-secondary hover:underline">
            Xem lượt đồng bộ
          </Link>
          {job?.queryId ? (
            <Link
              href={
                job.windowSince && job.windowUntil
                  ? mentionsWindowHref(job.queryId, job.windowSince, job.windowUntil)
                  : mentionsHref(job.queryId, "30d")
              }
              className="text-sm font-semibold text-brand-secondary hover:underline"
            >
              Xem bài nhắc của truy vấn →
            </Link>
          ) : null}
        </div>
        <Button color="secondary" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </>
  );
}
