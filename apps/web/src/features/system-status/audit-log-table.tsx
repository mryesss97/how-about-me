"use client";

import type { AuditLog } from "@how-about-me/contracts";
import Link from "next/link";
import { Fragment, useState } from "react";
import { PlaqueButton } from "@/features/shared/plaque-button";
import { DASH } from "@/lib/format/number";
import { formatDateTime } from "@/lib/time/format";
import { auditEntityCompact, auditEntityHref, auditEntityText, type NameMaps } from "./audit-format";
import { AuditLogDetail } from "./audit-log-detail";
import { auditActionText } from "./format";

const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-tertiary";
const TD = "px-3 py-3 align-top text-sm text-primary";

export const actorName = (a: AuditLog["actor"]) => (a ? (a.displayName ?? a.email ?? a.id) : "Hệ thống");

export type AuditListProps = {
  items: AuditLog[];
  tz: string;
  queryNames: Map<string, string>;
  memberNames: Map<string, string>;
  project?: NameMaps["project"];
};

/** Open/closed detail rows (each view keeps its own; only one view is visible at a time). */
export function useToggleSet() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { open, toggle };
}

export const hasDetail = (l: AuditLog) => l.metadata != null || l.requestId != null;

/**
 * #343 (ops-12): the audited object links to where it lives; unknown types stay text (BR-017: link text, not colour
 * alone). #393: named in words, full id only in `title`; `compact` drops what the action line already says (mobile).
 */
export function AuditEntity({
  log,
  names,
  className,
  compact,
}: {
  log: AuditLog;
  names: NameMaps;
  className?: string;
  compact?: { actionText: string };
}) {
  const text = compact
    ? (auditEntityCompact(log, compact.actionText, names)?.text ?? null)
    : auditEntityText(log, names);
  if (!text) return compact ? null : <>{DASH}</>;
  const href = auditEntityHref(log);
  return href ? (
    <Link
      href={href}
      title={log.entityId ?? undefined}
      className={`text-brand-secondary hover:underline ${className ?? ""}`}
    >
      {text}
    </Link>
  ) : (
    <span title={log.entityId ?? undefined}>{text}</span>
  );
}

/** Audit log list (FR-201, UX §3.6), `md`+ only (#343 cards below). "Chi tiết" expands metadata + request id. */
export function AuditLogTable({ items, tz, queryNames, memberNames, project }: AuditListProps) {
  const { open, toggle } = useToggleSet();
  return (
    <div className="operate-board hidden min-w-0 md:block">
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
              return (
                <Fragment key={l.id}>
                  <tr className="border-b border-secondary">
                    <td className={`${TD} whitespace-nowrap`}>{formatDateTime(l.createdAt, tz)}</td>
                    <td className={TD}>{actorName(l.actor)}</td>
                    <td className={TD} title={l.action}>
                      {auditActionText(l.action)}
                    </td>
                    <td className={TD}>
                      <AuditEntity log={l} names={{ queryNames, memberNames, project }} />
                    </td>
                    <td className={`${TD} text-right`}>
                      {hasDetail(l) ? (
                        <PlaqueButton
                          size="xs"
                          aria-expanded={expanded}
                          aria-controls={detailId}
                          onClick={() => toggle(l.id)}
                        >
                          Chi tiết
                        </PlaqueButton>
                      ) : null}
                    </td>
                  </tr>
                  {expanded ? (
                    <tr id={detailId} className="border-b border-secondary bg-secondary">
                      <td colSpan={5} className={TD}>
                        <AuditLogDetail log={l} tz={tz} />
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
