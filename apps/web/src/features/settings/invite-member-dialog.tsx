"use client";

import { AddMemberBodySchema, USER_ROLES, UserRoleSchema, type UserRole } from "@how-about-me/contracts";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { ApiError } from "@/lib/api/client";
import { roleLabelVi } from "@/lib/semantics/labels";
import { errorMessage, useAddMember } from "./api";
import { SettingsDialog } from "@/features/shared/settings-dialog";

export const ROLE_OPTIONS = USER_ROLES.map((r) => ({ value: r, label: roleLabelVi[r] }));

/** Invite by email (FR-033). `409 MEMBER_EXISTS` is shown inline under the email field. */
export function InviteMemberDialog({ pid, isOpen, onClose }: { pid: string; isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const add = useAddMember(pid);

  const close = () => {
    setEmail("");
    setRole("viewer");
    setEmailError(undefined);
    setFormError(undefined);
    onClose();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = AddMemberBodySchema.safeParse({ email: email.trim(), role });
    if (!parsed.success) {
      setEmailError("Nhập địa chỉ email hợp lệ.");
      return;
    }
    setEmailError(undefined);
    setFormError(undefined);
    add.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`Đã thêm ${parsed.data.email}`);
        close();
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "MEMBER_EXISTS") setEmailError(errorMessage(err));
        else setFormError(errorMessage(err));
      },
    });
  };

  return (
    <SettingsDialog isOpen={isOpen} onClose={close} title="Mời thành viên">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          isInvalid={!!emailError}
          hint={emailError}
          autoFocus
        />
        <NativeSelect
          label="Vai trò"
          value={role}
          onChange={(e) => setRole(UserRoleSchema.parse(e.target.value))}
          options={ROLE_OPTIONS}
        />
        {formError ? (
          <p role="alert" className="text-sm text-error-primary">
            {formError}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button type="button" color="secondary" onClick={close}>
            Huỷ
          </Button>
          <Button type="submit" isLoading={add.isPending}>
            Mời
          </Button>
        </div>
      </form>
    </SettingsDialog>
  );
}
