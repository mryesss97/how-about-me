"use client";

import { cx } from "@/utils/cx";
import { EnabledCell, MatchedLinks, QueryNameCell, SyncSummary, type QueryListProps } from "./query-cells";
import { QueryActionsMenu, type QueryActionHandlers } from "./query-actions-menu";

type Props = QueryActionHandlers & QueryListProps;

/** Row cards below `md` (#340 ops-2): name + ⋯ (44px), sync status, "Bài khớp" + enable toggle. */
export function QueriesListMobile({ items, tz, isAdmin, now, busyId, ...handlers }: Props) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {items.map((q) => (
        <li
          key={q.id}
          data-testid={`query-card-${q.id}`}
          className={cx("rounded-lg border border-secondary bg-primary p-4", q.deletedAt && "opacity-60")}
        >
          <div className="flex items-start justify-between gap-2">
            <QueryNameCell q={q} />
            <div className="-mt-2 -mr-2 shrink-0">
              <QueryActionsMenu query={q} isAdmin={isAdmin} {...handlers} />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <SyncSummary q={q} tz={tz} now={now} />
          </div>
          <div className="mt-3 flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>
              <span className="text-tertiary">Bài khớp </span>
              <MatchedLinks q={q} />
            </span>
            <EnabledCell q={q} isAdmin={isAdmin} busy={busyId === q.id} onToggle={handlers.onToggle} showLabel />
          </div>
        </li>
      ))}
    </ul>
  );
}
