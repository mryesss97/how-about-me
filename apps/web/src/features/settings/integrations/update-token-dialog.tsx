"use client";

import { PutThreadsIntegrationBodySchema } from "@how-about-me/contracts";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { integrationErrorMessage, useUpdateThreadsToken } from "./api";

/**
 * FR-043 / TC-INT-012: the token field is write-only — always starts empty, is cleared on close,
 * and never leaves this component except in the PUT body (CLAUDE.md secrets rule).
 */
export function UpdateTokenDialog({ pid, isOpen, onClose }: { pid: string; isOpen: boolean; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [account, setAccount] = useState("");
  const [expiry, setExpiry] = useState("");
  const [tokenError, setTokenError] = useState<string>();
  const [expiryError, setExpiryError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const update = useUpdateThreadsToken(pid);

  const close = () => {
    setToken("");
    setAccount("");
    setExpiry("");
    setTokenError(undefined);
    setExpiryError(undefined);
    setFormError(undefined);
    onClose();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    let tokenExpiresAt: string | undefined;
    if (expiry) {
      const d = new Date(`${expiry}T00:00:00.000Z`);
      if (Number.isNaN(d.getTime())) {
        setExpiryError("Ngày không hợp lệ.");
        return;
      }
      tokenExpiresAt = d.toISOString();
    }
    const parsed = PutThreadsIntegrationBodySchema.safeParse({
      accessToken: token.trim(),
      accountIdentifier: account.trim() || undefined,
      tokenExpiresAt,
    });
    if (!parsed.success) {
      const tokenIssue = parsed.error.issues.some((i) => i.path[0] === "accessToken");
      setTokenError(tokenIssue ? "Token phải dài 20–4096 ký tự." : undefined);
      setFormError(tokenIssue ? undefined : "Dữ liệu không hợp lệ.");
      return;
    }
    setTokenError(undefined);
    setExpiryError(undefined);
    setFormError(undefined);
    update.mutate(parsed.data, {
      onSuccess: () => {
        toast.success("Đã lưu token. Hãy kiểm tra kết nối.");
        close();
      },
      onError: (err) => setFormError(integrationErrorMessage(err)),
    });
  };

  return (
    <SettingsDialog isOpen={isOpen} onClose={close} title="Cập nhật token Threads">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Access token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={setToken}
          isInvalid={!!tokenError}
          hint={tokenError ?? "Token không bao giờ được hiển thị lại."}
          autoFocus
        />
        <Input label="Tài khoản (tuỳ chọn)" value={account} onChange={setAccount} />
        <Input
          label="Ngày hết hạn token (tuỳ chọn)"
          type="date"
          value={expiry}
          onChange={setExpiry}
          isInvalid={!!expiryError}
          hint={expiryError}
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
          <Button type="submit" isLoading={update.isPending}>
            Lưu token
          </Button>
        </div>
      </form>
    </SettingsDialog>
  );
}
