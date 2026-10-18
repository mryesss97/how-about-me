"use client";

import type { ProjectSettings, UserRole } from "@how-about-me/contracts";
import { useMutation } from "@tanstack/react-query";
import { Download01, Lock01 } from "@untitledui/icons";
import { useId, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { ApiError, apiDownload, type QueryParams } from "@/lib/api/client";
import { formatCount } from "@/lib/format/number";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { PlaqueButton, plaqueClassName } from "@/features/shared/plaque-button";

/** FR-032 / personas §3: UX only — the API enforces the same gate (FR-015, BR-033). */
export function canExport(role: UserRole | null, settings: Pick<ProjectSettings, "allowViewerExport"> | null) {
  if (role === "admin" || role === "analyst") return true;
  return role === "viewer" && settings?.allowViewerExport === true;
}

export type ExportGate = "allowed" | "viewer-disabled" | "hidden";

/**
 * #349: viewer without the project flag sees a locked button with the reason instead of nothing (FR-032, BR-033).
 * No role yet (or viewer before settings load) → hidden, so the button never flashes locked then enabled.
 */
export function exportGate(
  role: UserRole | null,
  settings: Pick<ProjectSettings, "allowViewerExport"> | null,
): ExportGate {
  if (canExport(role, settings)) return "allowed";
  return role === "viewer" && settings ? "viewer-disabled" : "hidden";
}

export const VIEWER_EXPORT_REASON = "Quản trị viên chưa bật quyền xuất cho Người xem";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function detailNumber(err: ApiError, key: string): number | null {
  const d: unknown = err.details;
  if (typeof d !== "object" || d === null || !(key in d)) return null;
  const v: unknown = (d as Record<string, unknown>)[key];
  return typeof v === "number" ? v : null;
}

function showError(err: unknown) {
  if (!(err instanceof ApiError)) {
    notifyError("Không xuất được CSV. Vui lòng thử lại.");
    return;
  }
  if (err.code === "EXPORT_TOO_LARGE") {
    const cap = detailNumber(err, "cap");
    notifyError("Quá nhiều bài nhắc để xuất", {
      description: `Mỗi lần xuất tối đa ${cap == null ? "số dòng cho phép" : `${formatCount(cap)} dòng`}. Hãy thu hẹp khoảng thời gian hoặc bộ lọc.`,
    });
  } else if (err.code === "RATE_LIMITED") {
    const s = detailNumber(err, "retryAfterSeconds");
    notifyError(`Đã chạm giới hạn xuất. Thử lại sau ${s ?? 60} giây.`);
  } else if (err.code === "FORBIDDEN_ROLE") {
    notifyError("Bạn không có quyền xuất dữ liệu.");
  } else {
    notifyError("Không xuất được CSV. Vui lòng thử lại.", {
      description: err.requestId ? `Mã yêu cầu: ${err.requestId}` : undefined,
    });
  }
}

/** GET …/mentions/export.csv with the list's pinned params (FR-180: same set as the visible list). */
export function useExportMentions(pid: string) {
  return useMutation({
    mutationFn: async (params: QueryParams) => {
      const { blob, filename } = await apiDownload(`/projects/${pid}/mentions/export.csv`, { params });
      saveBlob(blob, filename ?? "mentions.csv");
    },
    onSuccess: () => toast.success("Đã xuất xong"),
    onError: showError,
  });
}

/** Header action on /mentions — UX §3.3 (T-147). Render only when `exportGate` is "allowed". */
export function ExportButton({ pid, params }: { pid: string; params: QueryParams }) {
  const m = useExportMentions(pid);
  return (
    <PlaqueButton iconLeading={Download01} isLoading={m.isPending} onClick={() => m.mutate(params)}>
      Xuất CSV
    </PlaqueButton>
  );
}

/**
 * #349 locked export for viewers: `aria-disabled` (still focusable so the reason is reachable), lock icon + reason
 * tooltip — not grey alone (BR-017). Tap/press opens the tooltip too, since touch has no hover. Never calls the API.
 */
export function ExportButtonDisabled() {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip title={VIEWER_EXPORT_REASON} isOpen={open} onOpenChange={setOpen}>
        <AriaButton
          aria-disabled="true"
          aria-describedby={reasonId}
          onPress={() => setOpen(true)}
          className={plaqueClassName("sm", "cursor-not-allowed opacity-60")}
        >
          <Lock01 className="size-4 shrink-0" aria-hidden />
          Xuất CSV
        </AriaButton>
      </Tooltip>
      <span id={reasonId} className="sr-only">
        {VIEWER_EXPORT_REASON}
      </span>
    </>
  );
}
