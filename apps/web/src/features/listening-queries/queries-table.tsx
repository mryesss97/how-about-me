"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { Badge } from "@/components/base/badges/badges";
import { Toggle } from "@/components/base/toggle/toggle";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { DASH, formatCount } from "@/lib/format/number";
import { formatDateTime, formatRelativeOrAbsolute } from "@/lib/time/format";
import { cx } from "@/utils/cx";
import {
  formatDuration,
  formatQueryValue,
  queryTypeLabelVi,
  syncErrorLabel,
  syncStatus,
  type SyncTone,
} from "./format";
import { QueryActionsMenu, type QueryActionHandlers } from "./query-actions-menu";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm";

const DOT: Record<SyncTone, string> = {
  success: "bg-fg-success-secondary",
  error: "bg-fg-error-secondary",
  warning: "bg-fg-warning-secondary",
  progress: "bg-fg-brand-secondary",
  neutral: "bg-fg-quaternary",
};

type Props = QueryActionHandlers & { items: ListeningQuery[]; tz: string; isAdmin: boolean; now?: Date };

/** Listening Queries table (UX §3.5, FR-051/FR-061). Scrolls horizontally inside the board (#278). */
export function QueriesTable({ items, tz, isAdmin, now, ...handlers }: Props) {
  return (
    <div className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className="relative overflow-x-auto p-3">
        <table className="w-full">
          <thead className="border-b border-secondary bg-secondary">
            <tr>
              <th className={TH}>Truy vấn</th>
              <th className={TH}>Loại</th>
              <th className={TH}>Bật</th>
              <th className={TH}>Chu kỳ quét</th>
              <th className={TH}>Chồng lấn</th>
              <th className={TH}>Lần đồng bộ cuối</th>
              <th className={TH}>Kết quả gần nhất</th>
              <th className={TH}>Bài khớp (24h / tất cả)</th>
              <th className={TH}>Lỗi gần nhất</th>
              <th className={TH}>Người tạo</th>
              <th className={TH}>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <QueryRow key={q.id} q={q} tz={tz} isAdmin={isAdmin} now={now} handlers={handlers} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QueryRow({
  q,
  tz,
  isAdmin,
  now,
  handlers,
}: {
  q: ListeningQuery;
  tz: string;
  isAdmin: boolean;
  now?: Date;
  handlers: QueryActionHandlers;
}) {
  const deleted = !!q.deletedAt;
  const status = syncStatus(q);
  return (
    <tr data-testid={`query-row-${q.id}`} className={cx("border-t border-secondary", deleted && "opacity-60")}>
      <td className={TD}>
        <div className="flex items-center gap-2">
          <p className="font-medium text-primary">{q.displayName}</p>
          {deleted ? (
            <Badge size="sm" color="gray" type="pill-color">
              Đã xoá
            </Badge>
          ) : null}
        </div>
        <p className="text-tertiary">{formatQueryValue(q)}</p>
      </td>
      <td className={cx(TD, "whitespace-nowrap text-secondary")}>{queryTypeLabelVi[q.queryType]}</td>
      <td className={TD}>
        {isAdmin && !deleted ? (
          // Wired to PATCH { enabled } in #43; read-only until then.
          <Toggle
            size="sm"
            aria-label={`Bật ${q.displayName}`}
            isSelected={q.enabled}
            isDisabled={!handlers.onToggle}
            onChange={() => handlers.onToggle?.(q)}
          />
        ) : (
          <span className="text-secondary">{q.enabled ? "Bật" : "Tắt"}</span>
        )}
      </td>
      <td className={cx(TD, "whitespace-nowrap text-secondary")}>{formatDuration(q.pollIntervalSeconds)}</td>
      <td className={cx(TD, "whitespace-nowrap text-secondary")}>{formatDuration(q.overlapSeconds)}</td>
      <td className={cx(TD, "whitespace-nowrap")}>
        {/* BR-017: the dot always comes with a text label. */}
        <span className="flex items-center gap-2 text-secondary">
          <span aria-hidden className={cx("size-2 shrink-0 rounded-full", DOT[status.tone])} />
          {status.label}
        </span>
        <span
          className="text-tertiary"
          title={q.lastSuccessfulSyncAt ? formatDateTime(q.lastSuccessfulSyncAt, tz) : undefined}
        >
          {q.lastSuccessfulSyncAt ? formatRelativeOrAbsolute(q.lastSuccessfulSyncAt, now, tz) : DASH}
        </span>
      </td>
      <td className={cx(TD, "whitespace-nowrap tabular-nums text-secondary")}>
        {q.lastJob
          ? `${formatCount(q.lastJob.recordsFetched)} lấy / ${formatCount(q.lastJob.recordsInserted)} mới`
          : DASH}
      </td>
      <td className={cx(TD, "whitespace-nowrap tabular-nums text-secondary")}>
        {/* Server-side DISTINCT post_id counts; display only. */}
        {formatCount(q.matchedPosts.last24h)} / {formatCount(q.matchedPosts.total)}
      </td>
      <td className={cx(TD, "max-w-64")}>
        {q.lastError ? (
          <Tooltip
            title={`${q.lastError.code}: ${q.lastError.message}`}
            description={formatDateTime(q.lastError.at, tz)}
          >
            <TooltipTrigger
              aria-label={`${q.lastError.code}: ${q.lastError.message}`}
              className="text-left text-error-primary"
            >
              {syncErrorLabel(q.lastError.code, q.lastError.message)}
            </TooltipTrigger>
          </Tooltip>
        ) : (
          <span className="text-tertiary">{DASH}</span>
        )}
      </td>
      <td className={cx(TD, "whitespace-nowrap text-secondary")}>
        {q.createdBy ? (q.createdBy.displayName ?? q.createdBy.email ?? DASH) : DASH}
      </td>
      <td className={cx(TD, "text-right")}>
        <QueryActionsMenu query={q} isAdmin={isAdmin} {...handlers} />
      </td>
    </tr>
  );
}
