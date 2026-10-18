"use client";

import { UserRoleSchema, type Member, type UserRole } from "@how-about-me/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { NativeSelect } from "@/components/base/select/select-native";
import { roleLabelVi } from "@/lib/semantics/labels";
import { formatDateTime } from "@/lib/time/format";
import { errorMessage, useRemoveMember, useUpdateMemberRole } from "./api";
import { ROLE_OPTIONS } from "./invite-member-dialog";
import { SettingsDialog } from "@/features/shared/settings-dialog";

/** #347: visible text (not a `title` tooltip) under the sole admin; the 409 LAST_ADMIN error keeps its own message. */
const LAST_ADMIN_HINT = "Quản trị viên duy nhất — không thể đổi vai trò hay xoá.";

type Props = { pid: string; members: Member[]; timezone: string; currentUserId?: string };

/** Members table (UX §3.7, FR-034/FR-035). Last-admin locking is a hint only; the server returns `409 LAST_ADMIN`. */
export function MembersTable({ pid, members, timezone, currentUserId }: Props) {
  const updateRole = useUpdateMemberRole(pid, currentUserId);
  const remove = useRemoveMember(pid, currentUserId);
  // Optimistic value shown while the PATCH runs; cleared on settle so an error reverts to the server role.
  const [pending, setPending] = useState<{ userId: string; role: UserRole } | null>(null);
  const [error, setError] = useState<string>();
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const adminCount = members.filter((m) => m.role === "admin").length;

  const changeRole = (m: Member, role: UserRole) => {
    if (role === m.role) return;
    setError(undefined);
    setPending({ userId: m.userId, role });
    updateRole.mutate(
      { userId: m.userId, role },
      {
        onSuccess: () => toast.success(`${m.email} giờ là ${roleLabelVi[role]}`),
        onError: (err) => setError(errorMessage(err)),
        onSettled: () => setPending(null),
      },
    );
  };

  const confirmRemove = () => {
    if (!toRemove) return;
    const m = toRemove;
    setError(undefined);
    remove.mutate(m.userId, {
      onSuccess: () => toast.success(`Đã xoá ${m.email}`),
      onError: (err) => setError(errorMessage(err)),
      onSettled: () => setToRemove(null),
    });
  };

  type Row = { isLastAdmin: boolean; busy: boolean; hintId?: string };
  const rowProps = (m: Member, prefix = ""): Row => {
    const isLastAdmin = m.role === "admin" && adminCount <= 1;
    return {
      isLastAdmin,
      busy: pending?.userId === m.userId,
      hintId: isLastAdmin ? `${prefix}last-admin-${m.userId}` : undefined,
    };
  };
  const roleSelect = (m: Member, r: Row) => (
    <NativeSelect
      size="sm"
      aria-label={`Vai trò của ${m.email}`}
      aria-describedby={r.hintId}
      value={r.busy && pending ? pending.role : m.role}
      disabled={r.busy || r.isLastAdmin}
      onChange={(e) => changeRole(m, UserRoleSchema.parse(e.target.value))}
      options={ROLE_OPTIONS}
    />
  );
  const removeButton = (m: Member, r: Row, className?: string) => (
    <Button
      color="tertiary-destructive"
      size="sm"
      className={className}
      aria-label={`Xoá ${m.email}`}
      aria-describedby={r.hintId}
      isDisabled={r.isLastAdmin}
      onClick={() => setToRemove(m)}
    >
      Xoá
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-error-primary">
          {error}
        </p>
      ) : null}
      {/* #347: flat rules like Reviews, no nested frame; stacked list under `sm` (only one is displayed per breakpoint). */}
      {/* #327: `relative` contains the absolute sr-only header so it cannot widen the page. */}
      <div className="relative hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-secondary text-xs font-semibold text-tertiary">
            <tr>
              <th className="px-4 py-3">Thành viên</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Ngày thêm</th>
              <th className="px-4 py-3">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const row = rowProps(m);
              return (
                <tr key={m.userId} className="border-t border-secondary first:border-t-0">
                  <td className="px-4 py-3">
                    <MemberName m={m} isYou={m.userId === currentUserId} hintId={row.hintId} />
                  </td>
                  <td className="px-4 py-3">{roleSelect(m, row)}</td>
                  <td className="px-4 py-3 text-tertiary">{formatDateTime(m.createdAt, timezone)}</td>
                  <td className="px-4 py-3 text-right">{removeButton(m, row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul aria-label="Thành viên" className="flex flex-col sm:hidden">
        {members.map((m) => {
          const row = rowProps(m, "m-");
          return (
            <li key={m.userId} className="flex flex-col gap-2 border-t border-secondary py-3 text-sm first:border-t-0">
              <MemberName m={m} isYou={m.userId === currentUserId} hintId={row.hintId} />
              {roleSelect(m, row)}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-tertiary">Thêm lúc {formatDateTime(m.createdAt, timezone)}</p>
                {removeButton(m, row, "min-h-11")}
              </div>
            </li>
          );
        })}
      </ul>
      <SettingsDialog isOpen={!!toRemove} onClose={() => setToRemove(null)} title={`Xoá ${toRemove?.email ?? ""}?`}>
        <p className="text-sm text-tertiary">Người này sẽ mất quyền truy cập dự án ngay lập tức.</p>
        <div className="flex justify-end gap-3">
          <Button color="secondary" onClick={() => setToRemove(null)}>
            Huỷ
          </Button>
          <Button color="primary-destructive" isLoading={remove.isPending} onClick={confirmRemove}>
            Xoá
          </Button>
        </div>
      </SettingsDialog>
    </div>
  );
}

/** Name / email, "(bạn)" for the current user and the sole-admin reason as visible text (#347). */
function MemberName({ m, isYou, hintId }: { m: Member; isYou: boolean; hintId?: string }) {
  return (
    <div className="min-w-0">
      <p className="font-medium break-words text-primary">
        {m.displayName ?? m.email}
        {isYou ? <span className="font-normal text-tertiary"> (bạn)</span> : null}
      </p>
      {m.displayName ? <p className="break-words text-tertiary">{m.email}</p> : null}
      {hintId ? (
        <p id={hintId} className="mt-0.5 text-xs text-tertiary">
          {LAST_ADMIN_HINT}
        </p>
      ) : null}
    </div>
  );
}
