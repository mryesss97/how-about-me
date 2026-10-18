"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import Link from "next/link";
import { Badge } from "@/components/base/badges/badges";
import { Toggle } from "@/components/base/toggle/toggle";
import { formatCount } from "@/lib/format/number";
import { formatDateTime, formatRelativeOrAbsolute } from "@/lib/time/format";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { mentionsAllRelevanceHref } from "@/lib/links/mentions";
import { cx } from "@/utils/cx";
import { querySubline } from "./format";
import { LastErrorCell, SyncStatusCell } from "./sync-cells";

/** Shared by the desktop table and the mobile cards (#340). */
export type QueryListProps = {
  items: ListeningQuery[];
  tz: string;
  isAdmin: boolean;
  now?: Date;
  /** Row with a pending enable/disable PATCH; its toggle is disabled. */
  busyId?: string;
};

/** Name (max 2 lines, full name in `title`) + "Đã xoá" badge + "#value · Loại" subline (#340 ops-1). */
export function QueryNameCell({ q }: { q: ListeningQuery }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="line-clamp-2 font-medium text-primary" title={q.displayName}>
          {q.displayName}
        </p>
        {q.deletedAt ? (
          <Badge size="sm" color="gray" type="pill-color">
            Đã xoá
          </Badge>
        ) : null}
      </div>
      <p className="text-xs text-tertiary">{querySubline(q)}</p>
    </div>
  );
}

/**
 * "Đồng bộ gần nhất": status (dot + text, BR-017) · relative time; second line is the last error (tooltip keeps
 * `code: message`) or "N lấy · M mới" of the last job.
 */
export function SyncSummary({ q, tz, now }: { q: ListeningQuery; tz: string; now?: Date }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-1">
        <SyncStatusCell q={q} />
        {q.lastSuccessfulSyncAt ? (
          <span className="text-tertiary" title={formatDateTime(q.lastSuccessfulSyncAt, tz)}>
            · {formatRelativeOrAbsolute(q.lastSuccessfulSyncAt, now, tz)}
          </span>
        ) : null}
      </div>
      {q.lastError ? (
        <div className="max-w-64 text-xs">
          <LastErrorCell q={q} tz={tz} />
        </div>
      ) : q.lastJob ? (
        <p className="text-xs text-tertiary tabular-nums">
          {formatCount(q.lastJob.recordsFetched)} lấy · {formatCount(q.lastJob.recordsInserted)} mới
        </p>
      ) : null}
    </div>
  );
}

const MATCHED_24H_HINT = "Bài khớp mới thu thập trong 24 giờ qua (gồm cả bài chưa phân tích hoặc không liên quan)";
const MATCHED_TOTAL_HINT = "Bài khớp thu thập từ trước tới nay (gồm cả bài chưa phân tích hoặc không liên quan)";

function CountWithHint({ value, hint }: { value: number; hint: string }) {
  return (
    <Tooltip title={hint}>
      <TooltipTrigger aria-label={`${formatCount(value)}: ${hint}`} className="cursor-help text-secondary tabular-nums">
        {formatCount(value)}
      </TooltipTrigger>
    </Tooltip>
  );
}

/**
 * "Bài khớp mới" 24h / total (#391). These are ingest counts (DISTINCT matched posts by first match time, any
 * relevance), so they are plain text + tooltip, not links: Mentions counts by published_at with BR-016 relevance and
 * would show a different number (FR-142 exception documented in the UX spec §3.5). A separate number-free
 * "Xem bài nhắc" link opens Mentions with every relevance label.
 */
export function MatchedCounts({ q, align = "end" }: { q: ListeningQuery; align?: "start" | "end" }) {
  return (
    <span className={cx("inline-flex flex-col gap-0.5", align === "end" ? "items-end" : "items-start")}>
      <span className="whitespace-nowrap">
        <CountWithHint value={q.matchedPosts.last24h} hint={MATCHED_24H_HINT} />
        <span className="text-tertiary"> / </span>
        <CountWithHint value={q.matchedPosts.total} hint={MATCHED_TOTAL_HINT} />
      </span>
      <Link
        href={mentionsAllRelevanceHref(q.id)}
        aria-label={`Xem bài nhắc của ${q.displayName}`}
        className={cx(
          "text-xs text-secondary underline underline-offset-2",
          align === "start" && "inline-flex min-h-11 items-center",
        )}
      >
        Xem bài nhắc
      </Link>
    </span>
  );
}

/** PATCH { enabled } (FR-055) for admins on live queries; text otherwise. */
export function EnabledCell({
  q,
  isAdmin,
  busy,
  onToggle,
  showLabel = false,
}: {
  q: ListeningQuery;
  isAdmin: boolean;
  busy: boolean;
  onToggle?: (q: ListeningQuery) => void;
  showLabel?: boolean;
}) {
  if (!isAdmin || q.deletedAt) return <span className="text-secondary">{q.enabled ? "Bật" : "Tắt"}</span>;
  return (
    <Toggle
      size="sm"
      label={showLabel ? "Bật" : undefined}
      aria-label={`Bật ${q.displayName}`}
      isSelected={q.enabled}
      isDisabled={!onToggle || busy}
      onChange={() => onToggle?.(q)}
    />
  );
}
