"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { DotsVertical } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { mentionsHref } from "./format";

export type QueryActionHandlers = {
  onEdit?: (q: ListeningQuery) => void;
  onRun?: (q: ListeningQuery) => void;
  onBackfill?: (q: ListeningQuery) => void;
  onToggle?: (q: ListeningQuery) => void;
  onDelete?: (q: ListeningQuery) => void;
  onRestore?: (q: ListeningQuery) => void;
};

/** `/mentions` pre-filtered to one query (FR-062); `queryIds` is the URL filter key in lib/filters/parsers.ts. */
export const mentionsHrefFor = (id: string) => mentionsHref(id);

type Props = QueryActionHandlers & { query: ListeningQuery; isAdmin: boolean };
type Action = { id: string; label: string; run: () => void; danger?: boolean };

/**
 * Row actions (UX §3.5). "Xem bài nhắc" for every role; admin items only when `isAdmin` and a handler is wired.
 * Groups split by separators: view | edit/run/backfill | delete/restore (#340 ops-6). Enable/disable lives on the
 * row toggle only. Hiding is UX only — the API enforces `@Roles("admin")` (BR-033, FR-015).
 */
export function QueryActionsMenu({ query: q, isAdmin, onEdit, onRun, onBackfill, onDelete, onRestore }: Props) {
  const deleted = !!q.deletedAt;
  const ops: Action[] = isAdmin
    ? [
        !deleted && onEdit ? { id: "edit", label: "Sửa", run: () => onEdit(q) } : null,
        !deleted && onRun ? { id: "run", label: "Chạy ngay", run: () => onRun(q) } : null,
        // FR-063: disabled queries are rejected by the API (400), so the item is hidden for them.
        !deleted && q.enabled && onBackfill
          ? { id: "backfill", label: "Lấy dữ liệu cũ", run: () => onBackfill(q) }
          : null,
      ].filter((x) => x !== null)
    : [];
  const lifecycle: Action[] = isAdmin
    ? [
        !deleted && onDelete ? { id: "delete", label: "Xoá", run: () => onDelete(q), danger: true } : null,
        deleted && onRestore ? { id: "restore", label: "Khôi phục", run: () => onRestore(q) } : null,
      ].filter((x) => x !== null)
    : [];
  const all = [...ops, ...lifecycle];
  const item = (a: Action) => (
    <Dropdown.Item key={a.id} id={a.id} label={a.label} tone={a.danger ? "danger" : "default"} />
  );
  return (
    <Dropdown.Root>
      {/* Dropdown.DotsButton hard-codes its aria-label; rows need a per-query name. 44px hit area (#340 ops-2). */}
      <AriaButton
        aria-label={`Thao tác cho ${q.displayName}`}
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-fg-quaternary outline-focus-ring hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <DotsVertical aria-hidden="true" className="size-5" />
      </AriaButton>
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            all.find((a) => a.id === key)?.run();
          }}
        >
          <Dropdown.Item id="mentions" href={mentionsHrefFor(q.id)} label="Xem bài nhắc" />
          {ops.length ? <Dropdown.Separator /> : null}
          {ops.map(item)}
          {lifecycle.length ? <Dropdown.Separator /> : null}
          {lifecycle.map(item)}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
