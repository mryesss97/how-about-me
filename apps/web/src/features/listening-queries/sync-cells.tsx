"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import Link from "next/link";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { DASH } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { cx } from "@/utils/cx";
import { isStaleError, jobHref, syncErrorLabel, syncStatus, type SyncTone } from "./format";

const DOT: Record<SyncTone, string> = {
  success: "bg-fg-success-secondary",
  error: "bg-fg-error-secondary",
  warning: "bg-fg-warning-secondary",
  progress: "bg-fg-brand-secondary",
  neutral: "bg-fg-quaternary",
};

/** "Lần đồng bộ cuối" status: dot + label (BR-017); links to the sync job it describes (#342). */
export function SyncStatusCell({ q }: { q: ListeningQuery }) {
  const status = syncStatus(q);
  const body = (
    <>
      <span aria-hidden className={cx("size-2 shrink-0 rounded-full", DOT[status.tone])} />
      {status.label}
    </>
  );
  if (!q.lastJob) return <span className="flex items-center gap-2 text-secondary">{body}</span>;
  return (
    <Link
      href={jobHref(q.lastJob.id, q.id)}
      aria-label={`${status.label} — xem lượt đồng bộ`}
      className="flex items-center gap-2 text-secondary underline-offset-2 hover:underline"
    >
      {body}
    </Link>
  );
}

/**
 * "Lỗi gần nhất" (#342 flows-5): a current error is red and links to the failed/partial last job; an error followed
 * by a successful sync is grey with "đã đồng bộ lại" and no link (the contract has no job id for the error).
 */
export function LastErrorCell({ q, tz }: { q: ListeningQuery; tz: string }) {
  const err = q.lastError;
  if (!err) return <span className="text-tertiary">{DASH}</span>;
  const stale = isStaleError(q);
  const failedJob = !stale && q.lastJob && (q.lastJob.status === "failed" || q.lastJob.status === "partial");
  // #385: Vietnamese label as tooltip title/accessible name; the raw code only on the muted "Mã: …" line.
  const label = syncErrorLabel(err.code, err.message);
  const shown = stale ? `Lỗi lúc ${formatDateTime(err.at, tz)}, đã đồng bộ lại` : label;
  return (
    <>
      <Tooltip title={label} description={`${formatDateTime(err.at, tz)} · Mã: ${err.code}`}>
        <TooltipTrigger aria-label={shown} className={cx("text-left", stale ? "text-tertiary" : "text-error-primary")}>
          {shown}
        </TooltipTrigger>
      </Tooltip>
      {failedJob && q.lastJob ? (
        <Link
          href={jobHref(q.lastJob.id, q.id)}
          className="block text-xs font-semibold text-secondary underline underline-offset-2"
        >
          Xem lượt lỗi
        </Link>
      ) : null}
    </>
  );
}
