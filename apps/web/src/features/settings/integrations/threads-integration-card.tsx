"use client";

import type { IntegrationStatus, ThreadsIntegrationStatus } from "@how-about-me/contracts";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { StatusPlate } from "@/features/shared/status-plate";
import { formatCount } from "@/lib/format/number";
import { tokenDaysLeft, tokenExpiryState } from "@/lib/semantics/token-expiry";
import { formatDateTime } from "@/lib/time/format";
import { DisconnectDialog } from "./disconnect-dialog";
import { UpdateTokenDialog } from "./update-token-dialog";
import { useVerifyWithNextStep } from "./use-verify-with-next-step";

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
      <dt className="shrink-0 sm:w-36 text-sm text-tertiary">{label}</dt>
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
  const verify = useVerifyWithNextStep(pid);
  // One clock reading per mount keeps "còn N ngày" stable across re-renders.
  const [nowMs] = useState(() => Date.now());
  const badge = STATUS_BADGE[status.status];
  const fmt = (v: string | null) => (v ? formatDateTime(v, timezone) : "—");
  const days = tokenDaysLeft(status.tokenExpiresAt, nowMs);
  const expiry = tokenExpiryState(status.status, status.tokenExpiresAt, nowMs);
  // #346: exactly one primary — "Kiểm tra kết nối" when healthy, otherwise the fix ("Cập nhật token").
  const verifyFirst = status.status === "connected" && expiry !== "soon" && expiry !== "expired";

  const onVerify = () => verify.run();
  // FR-043: PUT stays verify-free; the UI runs the separate verify right after, replacing the loading toast.
  const onSaved = () => verify.run(toast.loading("Đã lưu token. Đang kiểm tra kết nối…"));

  const updateBtn = (
    <Button color={verifyFirst ? "secondary" : "primary"} onClick={() => setDialog("token")}>
      Cập nhật token
    </Button>
  );
  const verifyBtn = (
    <Button
      color={verifyFirst ? "primary" : "secondary"}
      isLoading={verify.isPending}
      isDisabled={verify.isPending}
      onClick={onVerify}
    >
      Kiểm tra kết nối
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge type="pill-color" color={badge.color} size="md">
          {badge.label}
        </Badge>
        {/* FR-046 / BR-017: the warning is spelled out, not colour only. */}
        {expiry === "soon" ? <StatusPlate label="Sắp hết hạn" tone="warning" /> : null}
      </div>
      <dl className="flex flex-col gap-3">
        <Row label="Tài khoản">{status.accountIdentifier ?? "—"}</Row>
        <Row label="Quyền truy cập">
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
        <Row label="Token hết hạn">
          {fmt(status.tokenExpiresAt)}
          {days != null ? (
            <span className="text-tertiary">{days > 0 ? ` · còn ${formatCount(days)} ngày` : " · đã quá hạn"}</span>
          ) : null}
        </Row>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-3">
            {verifyFirst ? verifyBtn : updateBtn}
            {verifyFirst ? updateBtn : verifyBtn}
          </div>
          {/* Destructive action kept apart: right on desktop, own row under a 1px rule on mobile. */}
          <div className="border-t border-secondary pt-3 sm:ml-auto sm:border-0 sm:pt-0">
            <Button color="secondary-destructive" onClick={() => setDialog("disconnect")}>
              Ngắt kết nối
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-tertiary">Chỉ quản trị viên dự án mới thay đổi được các cài đặt này.</p>
      )}
      {canEdit ? (
        <>
          <UpdateTokenDialog pid={pid} isOpen={dialog === "token"} onClose={() => setDialog(null)} onSaved={onSaved} />
          <DisconnectDialog pid={pid} isOpen={dialog === "disconnect"} onClose={() => setDialog(null)} />
        </>
      ) : null}
    </div>
  );
}
