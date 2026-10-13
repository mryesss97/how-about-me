"use client";

import { AddMemberBodySchema, USER_ROLES, UserRoleSchema, type UserRole } from "@how-about-me/contracts";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { ApiError } from "@/lib/api/client";
import { errorMessage, useAddMember } from "./api";
import { SettingsDialog } from "@/features/shared/settings-dialog";

export const ROLE_OPTIONS = USER_ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }));

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
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(undefined);
    setFormError(undefined);
    add.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(`Added ${parsed.data.email}`);
        close();
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "MEMBER_EXISTS") setEmailError(errorMessage(err));
        else setFormError(errorMessage(err));
      },
    });
  };

  return (
    <SettingsDialog isOpen={isOpen} onClose={close} title="Invite member">
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
          label="Role"
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
            Cancel
          </Button>
          <Button type="submit" isLoading={add.isPending}>
            Invite
          </Button>
        </div>
      </form>
    </SettingsDialog>
  );
}
