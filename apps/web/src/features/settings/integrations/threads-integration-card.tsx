"use client";

import type { IntegrationStatus, ThreadsIntegrationStatus } from "@how-about-me/contracts";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { formatDateTime } from "@/lib/time/format";
import { integrationErrorMessage, useVerifyThreads } from "./api";
import { DisconnectDialog } from "./disconnect-dialog";
import { UpdateTokenDialog } from "./update-token-dialog";

/** FR-044 status → label/colour. */
export const STATUS_BADGE: Record<
  IntegrationStatus,
  { label: string; color: "success" | "warning" | "error" | "gray" }
> = {
  connected: { label: "Đã kết nối", color: "success" },
  expired: { label: "Hết hạn", color: "warning" },
  permission_error: { label: "Lỗi quyền", color: "error" },
  error: { label: "Lỗi", color: "error" },
  disconnected: { label: "Chưa kết nối", color: "gray" },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-44 shrink-0 text-sm text-tertiary">{label}</dt>
      <dd className="text-sm text-primary">{children}</dd>
    </div>
  );
}

/** Threads card (UX §3.7). `canEdit=false` (analyst) renders no controls — FR-015 is enforced by the API. */
export function ThreadsIntegrationCard({
  pid,
  status,
  canEdit,
  timezone,
}: {
  pid: string;
  status: ThreadsIntegrationStatus;
  canEdit: boolean;
  timezone: string;
}) {
  const [dialog, setDialog] = useState<"token" | "disconnect" | null>(null);
  const verify = useVerifyThreads(pid);
  const badge = STATUS_BADGE[status.status];
  const fmt = (v: string | null) => (v ? formatDateTime(v, timezone) : "—");

  const onVerify = () =>
    verify.mutate(undefined, {
      onSuccess: () => toast.success("Kết nối Threads hoạt động"),
      onError: (err) => toast.error(integrationErrorMessage(err)),
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Badge type="pill-color" color={badge.color} size="md">
          {badge.label}
        </Badge>
      </div>
      <dl className="flex flex-col gap-3">
        <Row label="Tài khoản">{status.accountIdentifier ?? "—"}</Row>
        <Row label="Quyền (scopes)">
          {status.grantedScopes.length ? (
            <span className="flex flex-wrap gap-1">
              {status.grantedScopes.map((s) => (
                <Badge key={s} type="modern" color="gray" size="sm">
                  {s}
                </Badge>
              ))}
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Token hết hạn">{fmt(status.tokenExpiresAt)}</Row>
        <Row label="Kiểm tra lần cuối">{fmt(status.lastVerifiedAt)}</Row>
        <Row label="Thành công lần cuối">{fmt(status.lastSuccessAt)}</Row>
        <Row label="Lỗi gần nhất">
          {status.lastError ? (
            <span>
              <code className="font-mono">{status.lastError.code}</code> — {status.lastError.message} (
              {fmt(status.lastError.at)})
            </span>
          ) : (
            "—"
          )}
        </Row>
      </dl>
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setDialog("token")}>Cập nhật token</Button>
          <Button color="secondary" isLoading={verify.isPending} isDisabled={verify.isPending} onClick={onVerify}>
            Kiểm tra kết nối
          </Button>
          <Button color="secondary-destructive" onClick={() => setDialog("disconnect")}>
            Ngắt kết nối
          </Button>
        </div>
      ) : (
        <p className="text-sm text-tertiary">Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.</p>
      )}
      {canEdit ? (
        <>
          <UpdateTokenDialog pid={pid} isOpen={dialog === "token"} onClose={() => setDialog(null)} />
          <DisconnectDialog pid={pid} isOpen={dialog === "disconnect"} onClose={() => setDialog(null)} />
        </>
      ) : null}
    </div>
  );
}
