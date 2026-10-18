"use client";

import type { ProjectSettings, UserRole } from "@how-about-me/contracts";
import { useMutation } from "@tanstack/react-query";
import { Download01 } from "@untitledui/icons";
import { toast } from "sonner";
import { ApiError, apiDownload, type QueryParams } from "@/lib/api/client";
import { formatCount } from "@/lib/format/number";

/** FR-032 / personas §3: UX only — the API enforces the same gate (FR-015, BR-033). */
export function canExport(role: UserRole | null, settings: Pick<ProjectSettings, "allowViewerExport"> | null) {
  if (role === "admin" || role === "analyst") return true;
  return role === "viewer" && settings?.allowViewerExport === true;
}

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
    toast.error("Xuất thất bại. Vui lòng thử lại.");
    return;
  }
  if (err.code === "EXPORT_TOO_LARGE") {
    const cap = detailNumber(err, "cap");
    toast.error("Quá nhiều bài nhắc để xuất", {
      description: `Mỗi lần xuất tối đa ${cap == null ? "số dòng cho phép" : `${formatCount(cap)} dòng`}. Hãy thu hẹp khoảng thời gian hoặc bộ lọc.`,
    });
  } else if (err.code === "RATE_LIMITED") {
    const s = detailNumber(err, "retryAfterSeconds");
    toast.error(`Đã chạm giới hạn xuất. Thử lại sau ${s ?? 60} giây.`);
  } else if (err.code === "FORBIDDEN_ROLE") {
    toast.error("Bạn không có quyền xuất dữ liệu.");
  } else {
    toast.error("Xuất thất bại. Vui lòng thử lại.", {
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

/** Header action on /mentions — UX §3.3 (T-147). Render only when `canExport`. */
export function ExportButton({ pid, params }: { pid: string; params: QueryParams }) {
  const m = useExportMentions(pid);
  return (
    <button
      type="button"
      disabled={m.isPending}
      aria-busy={m.isPending}
      onClick={() => m.mutate(params)}
      className="plaque-button inline-flex min-h-11 md:min-h-0 items-center gap-2 px-3 py-1.5 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
    >
      <Download01 className="size-4" aria-hidden />
      Xuất CSV
    </button>
  );
}
