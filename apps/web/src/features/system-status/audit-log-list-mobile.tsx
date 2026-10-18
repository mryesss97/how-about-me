"use client";

import { PlaqueButton } from "@/features/shared/plaque-button";
import { formatDateTime } from "@/lib/time/format";
import { AuditLogDetail } from "./audit-log-detail";
import { actorName, AuditEntity, hasDetail, useToggleSet, type AuditListProps } from "./audit-log-table";
import { auditActionText } from "./format";

/** #343 (ops-8/ops-12): audit log as cards below `md`. */
export function AuditLogListMobile({ items, tz, queryNames, memberNames }: AuditListProps) {
  const { open, toggle } = useToggleSet();
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {items.map((l) => {
        const expanded = open.has(l.id);
        const detailId = `audit-card-detail-${l.id}`;
        return (
          <li
            key={l.id}
            data-testid={`audit-card-${l.id}`}
            className="rounded-lg border border-secondary bg-primary p-4"
          >
            <p className="text-xs text-tertiary">
              <span className="tabular-nums">{formatDateTime(l.createdAt, tz)}</span> · {actorName(l.actor)}
            </p>
            <p className="mt-1 text-sm font-semibold text-primary" title={l.action}>
              {auditActionText(l.action)}
            </p>
            <div className="text-sm text-primary">
              <AuditEntity log={l} names={{ queryNames, memberNames }} className="inline-flex min-h-11 items-center" />
            </div>
            {hasDetail(l) ? (
              <PlaqueButton
                className="mt-2 min-h-11 w-full justify-center"
                aria-expanded={expanded}
                aria-controls={detailId}
                onClick={() => toggle(l.id)}
              >
                Chi tiết
              </PlaqueButton>
            ) : null}
            {expanded ? (
              <div id={detailId} className="mt-3">
                <AuditLogDetail log={l} tz={tz} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
