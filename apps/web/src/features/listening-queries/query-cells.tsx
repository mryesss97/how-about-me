"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import Link from "next/link";
import { Badge } from "@/components/base/badges/badges";
import { Toggle } from "@/components/base/toggle/toggle";
import { formatCount } from "@/lib/format/number";
import { formatDateTime, formatRelativeOrAbsolute } from "@/lib/time/format";
import { mentionsHref, querySubline } from "./format";
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

/** "Bài khớp" 24h / total, each a link to Mentions filtered to the query (#340 flows-6; total → 30d, no "all" preset). */
export function MatchedLinks({ q }: { q: ListeningQuery }) {
  const cls = "text-secondary underline-offset-2 hover:underline";
  return (
    <span className="tabular-nums whitespace-nowrap">
      {/* Server-side DISTINCT post_id counts; display only. */}
      <Link
        href={mentionsHref(q.id, "24h")}
        aria-label={`Xem ${formatCount(q.matchedPosts.last24h)} bài khớp 24 giờ qua của ${q.displayName}`}
        className={cls}
      >
        {formatCount(q.matchedPosts.last24h)}
      </Link>
      <span className="text-tertiary"> / </span>
      <Link
        href={mentionsHref(q.id, "30d")}
        aria-label={`Xem bài khớp 30 ngày qua của ${q.displayName} (tổng ${formatCount(q.matchedPosts.total)})`}
        className={cls}
      >
        {formatCount(q.matchedPosts.total)}
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
