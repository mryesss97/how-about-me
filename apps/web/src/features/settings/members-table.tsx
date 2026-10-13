"use client";

import { UserRoleSchema, type Member, type UserRole } from "@how-about-me/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { NativeSelect } from "@/components/base/select/select-native";
import { formatDateTime } from "@/lib/time/format";
import { errorMessage, useRemoveMember, useUpdateMemberRole } from "./api";
import { ROLE_OPTIONS } from "./invite-member-dialog";
import { SettingsDialog } from "@/features/shared/settings-dialog";

const LAST_ADMIN_HINT = "Project must keep at least one admin.";

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
        onSuccess: () => toast.success(`${m.email} is now ${role}`),
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
      onSuccess: () => toast.success(`Removed ${m.email}`),
      onError: (err) => setError(errorMessage(err)),
      onSettled: () => setToRemove(null),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-error-primary">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-secondary">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-xs font-semibold text-tertiary">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isLastAdmin = m.role === "admin" && adminCount <= 1;
              const busy = pending?.userId === m.userId;
              return (
                <tr key={m.userId} className="border-t border-secondary">
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{m.displayName ?? m.email}</p>
                    {m.displayName ? <p className="text-tertiary">{m.email}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <NativeSelect
                      size="sm"
                      aria-label={`Role for ${m.email}`}
                      value={busy && pending ? pending.role : m.role}
                      disabled={busy || isLastAdmin}
                      title={isLastAdmin ? LAST_ADMIN_HINT : undefined}
                      onChange={(e) => changeRole(m, UserRoleSchema.parse(e.target.value))}
                      options={ROLE_OPTIONS}
                    />
                  </td>
                  <td className="px-4 py-3 text-tertiary">{formatDateTime(m.createdAt, timezone)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      color="tertiary-destructive"
                      size="sm"
                      aria-label={`Remove ${m.email}`}
                      isDisabled={isLastAdmin}
                      title={isLastAdmin ? LAST_ADMIN_HINT : undefined}
                      onClick={() => setToRemove(m)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SettingsDialog isOpen={!!toRemove} onClose={() => setToRemove(null)} title={`Remove ${toRemove?.email ?? ""}?`}>
        <p className="text-sm text-tertiary">They will lose access to this project immediately.</p>
        <div className="flex justify-end gap-3">
          <Button color="secondary" onClick={() => setToRemove(null)}>
            Cancel
          </Button>
          <Button color="primary-destructive" isLoading={remove.isPending} onClick={confirmRemove}>
            Remove
          </Button>
        </div>
      </SettingsDialog>
    </div>
  );
}
