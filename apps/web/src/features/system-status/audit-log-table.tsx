"use client";

import type { AuditLog } from "@how-about-me/contracts";
import { Fragment, useState } from "react";
import { DASH } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { auditActionText, truncateMiddle, auditEntityLabel } from "./format";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm text-primary";

const actorName = (a: AuditLog["actor"]) => (a ? (a.displayName ?? a.email ?? a.id) : "Hệ thống");

/** Audit log list (FR-201, UX §3.6). "Chi tiết" expands sanitized metadata + request id. */
export function AuditLogTable({ items, tz }: { items: AuditLog[]; tz: string }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="operate-board min-w-0">
      <span aria-hidden className="sign-keyline" />
      <div className="relative overflow-x-auto p-3">
        <table className="w-full">
          <thead className="border-b border-secondary bg-secondary">
            <tr>
              <th className={TH}>Thời gian</th>
              <th className={TH}>Người thực hiện</th>
              <th className={TH}>Thao tác</th>
              <th className={TH}>Đối tượng</th>
              <th className={TH}>
                <span className="sr-only">Chi tiết</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => {
              const expanded = open.has(l.id);
              const detailId = `audit-detail-${l.id}`;
              const hasDetail = l.metadata != null || l.requestId != null;
              return (
                <Fragment key={l.id}>
                  <tr className="border-b border-secondary">
                    <td className={`${TD} whitespace-nowrap`}>{formatDateTime(l.createdAt, tz)}</td>
                    <td className={TD}>{actorName(l.actor)}</td>
                    <td className={TD} title={l.action}>
                      {auditActionText(l.action)}
                    </td>
                    <td className={TD} title={l.entityId ?? undefined}>
                      {l.entityType ? auditEntityLabel(l.entityType) : DASH}
                      {l.entityId ? ` · ${truncateMiddle(l.entityId, 16)}` : ""}
                    </td>
                    <td className={`${TD} text-right`}>
                      {hasDetail ? (
                        <button
                          type="button"
                          className="plaque-button px-2 py-1 text-xs"
                          aria-expanded={expanded}
                          aria-controls={detailId}
                          onClick={() => toggle(l.id)}
                        >
                          Chi tiết
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr id={detailId} className="border-b border-secondary bg-secondary">
                      <td colSpan={5} className={TD}>
                        {l.metadata ? (
                          <pre className="max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">
                            {JSON.stringify(l.metadata, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-xs text-tertiary">Không có dữ liệu bổ sung.</p>
                        )}
                        {l.requestId ? <p className="mt-2 text-xs text-tertiary">Mã yêu cầu: {l.requestId}</p> : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
