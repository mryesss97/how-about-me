"use client";

import type { ProjectSettings, UserRole } from "@how-about-me/contracts";
import { useMutation } from "@tanstack/react-query";
import { Download01 } from "@untitledui/icons";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
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
    toast.error("Export failed. Please try again.");
    return;
  }
  if (err.code === "EXPORT_TOO_LARGE") {
    const cap = detailNumber(err, "cap");
    toast.error("Too many mentions to export", {
      description: `Exports are limited to ${cap == null ? "the row cap" : `${formatCount(cap)} rows`}. Narrow the date range or filters.`,
    });
  } else if (err.code === "RATE_LIMITED") {
    const s = detailNumber(err, "retryAfterSeconds");
    toast.error(`Export limit reached. Try again in ${s ?? 60} seconds.`);
  } else if (err.code === "FORBIDDEN_ROLE") {
    toast.error("You don't have permission to export.");
  } else {
    toast.error("Export failed. Please try again.", {
      description: err.requestId ? `Request ID: ${err.requestId}` : undefined,
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
    onSuccess: () => toast.success("Export ready"),
    onError: showError,
  });
}

/** Header action on /mentions — UX §3.3 (T-147). Render only when `canExport`. */
export function ExportButton({ pid, params }: { pid: string; params: QueryParams }) {
  const m = useExportMentions(pid);
  return (
    <Button
      color="secondary"
      size="sm"
      iconLeading={Download01}
      isLoading={m.isPending}
      isDisabled={m.isPending}
      onClick={() => m.mutate(params)}
    >
      Export CSV
    </Button>
  );
}
