"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { cx } from "@/utils/cx";
import { formatDuration } from "./format";
import { EnabledCell, MatchedLinks, QueryNameCell, SyncSummary, type QueryListProps } from "./query-cells";
import { QueryActionsMenu, type QueryActionHandlers } from "./query-actions-menu";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm";
// The ⋯ column stays visible at 1366 even when the board scrolls (#340 ops-1); solid background so text slides under.
const STICKY = "sticky right-0 border-l border-[var(--ink)]";

type Props = QueryActionHandlers & QueryListProps;

/** Listening Queries table, 6 columns (UX §3.5, FR-051/FR-061, #340). Shown from `md`; cards below. */
export function QueriesTable({ items, tz, isAdmin, now, busyId, ...handlers }: Props) {
  return (
    <div className="operate-board hidden min-w-0 md:block">
      <span aria-hidden className="sign-keyline" />
      <div className="relative overflow-x-auto p-3">
        <table className="w-full">
          <thead className="border-b border-secondary bg-secondary">
            <tr>
              <th className={TH}>Truy vấn</th>
              <th className={TH}>Bật</th>
              <th className={TH}>Đồng bộ gần nhất</th>
              <th className={TH}>Lịch quét</th>
              <th className={cx(TH, "text-right")}>Bài khớp (24 giờ / tất cả)</th>
              <th className={cx(TH, STICKY, "bg-secondary")}>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((q) => (
              <QueryRow
                key={q.id}
                q={q}
                tz={tz}
                isAdmin={isAdmin}
                now={now}
                busy={busyId === q.id}
                handlers={handlers}
              />
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
  busy,
  handlers,
}: {
  q: ListeningQuery;
  tz: string;
  isAdmin: boolean;
  now?: Date;
  busy: boolean;
  handlers: QueryActionHandlers;
}) {
  return (
    <tr data-testid={`query-row-${q.id}`} className={cx("border-t border-secondary", q.deletedAt && "opacity-60")}>
      <td className={cx(TD, "min-w-[200px]")}>
        <QueryNameCell q={q} />
      </td>
      <td className={TD}>
        <EnabledCell q={q} isAdmin={isAdmin} busy={busy} onToggle={handlers.onToggle} />
      </td>
      <td className={TD}>
        <SyncSummary q={q} tz={tz} now={now} />
      </td>
      <td className={cx(TD, "whitespace-nowrap text-secondary")}>
        <p>{formatDuration(q.pollIntervalSeconds)}</p>
        <p className="text-xs text-tertiary">chồng lấn {formatDuration(q.overlapSeconds)}</p>
      </td>
      <td className={cx(TD, "text-right")}>
        <MatchedLinks q={q} />
      </td>
      <td className={cx(TD, STICKY, "bg-[var(--enamel-white)] py-1 text-right")}>
        <QueryActionsMenu query={q} isAdmin={isAdmin} {...handlers} />
      </td>
    </tr>
  );
}
