"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { DotsVertical } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { Dropdown } from "@/components/base/dropdown/dropdown";

export type QueryActionHandlers = {
  onEdit?: (q: ListeningQuery) => void;
  onRun?: (q: ListeningQuery) => void;
  onToggle?: (q: ListeningQuery) => void;
  onDelete?: (q: ListeningQuery) => void;
  onRestore?: (q: ListeningQuery) => void;
};

/** `/mentions` pre-filtered to one query (FR-062); `queryIds` is the URL filter key in lib/filters/parsers.ts. */
export const mentionsHrefFor = (id: string) => `/mentions?queryIds=${id}`;

type Props = QueryActionHandlers & { query: ListeningQuery; isAdmin: boolean };

/**
 * Row actions (UX §3.5). "Xem bài nhắc" for every role; admin items only when `isAdmin` and a handler is wired
 * (#43 wires mutations). Hiding is UX only — the API enforces `@Roles("admin")` (BR-033, FR-015).
 */
export function QueryActionsMenu({ query: q, isAdmin, onEdit, onRun, onToggle, onDelete, onRestore }: Props) {
  const deleted = !!q.deletedAt;
  const admin = isAdmin
    ? [
        !deleted && onEdit ? { id: "edit", label: "Sửa", run: () => onEdit(q) } : null,
        !deleted && onRun ? { id: "run", label: "Chạy ngay", run: () => onRun(q) } : null,
        !deleted && onToggle ? { id: "toggle", label: q.enabled ? "Tắt" : "Bật", run: () => onToggle(q) } : null,
        !deleted && onDelete ? { id: "delete", label: "Xoá", run: () => onDelete(q) } : null,
        deleted && onRestore ? { id: "restore", label: "Khôi phục", run: () => onRestore(q) } : null,
      ].filter((x) => x !== null)
    : [];
  return (
    <Dropdown.Root>
      {/* Dropdown.DotsButton hard-codes its aria-label; rows need a per-query name. */}
      <AriaButton
        aria-label={`Thao tác cho ${q.displayName}`}
        className="cursor-pointer rounded-md p-1 text-fg-quaternary outline-focus-ring hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <DotsVertical aria-hidden="true" className="size-5" />
      </AriaButton>
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            admin.find((a) => a.id === key)?.run();
          }}
        >
          <Dropdown.Item id="mentions" href={mentionsHrefFor(q.id)} label="Xem bài nhắc" />
          {admin.map((a) => (
            <Dropdown.Item key={a.id} id={a.id} label={a.label} />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
