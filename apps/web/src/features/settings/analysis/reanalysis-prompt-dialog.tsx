"use client";

import type { MarkStaleResponse } from "@how-about-me/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { ApiError } from "@/lib/api/client";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { retryAfterSeconds } from "@/lib/api/rate-limit";
import { formatCount } from "@/lib/format/number";
import { useMarkStale } from "./api";

const fmt = formatCount;

/** Vietnamese wait phrase for `Retry-After` (the shared `waitText` is English). */
function waitTextVi(seconds: number | null): string {
  if (seconds === null) return "ít phút nữa";
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} giây`;
  return `${Math.ceil(seconds / 60)} phút`;
}

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "RATE_LIMITED")
    return `Vừa có yêu cầu phân tích lại. Thử lại sau ${waitTextVi(retryAfterSeconds(err))}.`;
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR")
    return "Phiên bản này đang là phiên bản hiện tại; không có gì để phân tích lại.";
  const rid = err instanceof ApiError && err.requestId ? ` (mã yêu cầu ${err.requestId})` : "";
  return `Không thể bắt đầu phân tích lại${rid}.`;
}

/**
 * FR-196: offered to admins after a new policy version when posts were analysed with an older one.
 * "Re-analyse" first previews (`dryRun=true`) then on confirm marks results of `version` stale and
 * enqueues up to `cap` posts (BR-023; results stay append-only, BR-003). Server enforces admin (FR-015).
 */
export function ReanalysisPromptDialog({
  pid,
  version,
  outdatedCount,
  isOpen,
  onClose,
}: {
  pid: string;
  /** The `effectiveVersion` that was current before the save. */
  version: string;
  outdatedCount: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const m = useMarkStale(pid);
  const [preview, setPreview] = useState<MarkStaleResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  // Nothing to stale (version already current, or no run of it left): a real call would only use the
  // project's 5-minute bulk window (FR-196), so only Close is offered.
  const nothingToDo = preview !== null && preview.marked === 0;
  const terminal = nothingToDo || (error instanceof ApiError && error.code === "VALIDATION_ERROR");
  const rateLimited = error instanceof ApiError && error.code === "RATE_LIMITED";

  const run = (dryRun: boolean) => {
    setError(null);
    m.mutate(
      { version, dryRun },
      {
        onSuccess: (r) => {
          if (dryRun) return setPreview(r);
          toast.success(
            r.enqueued > 0
              ? `Đã đưa ${fmt(r.enqueued)} bài vào hàng đợi phân tích lại`
              : "Không có bài nào cần phân tích lại",
          );
          onClose();
        },
        onError: setError,
      },
    );
  };

  return (
    <SettingsDialog isOpen={isOpen} onClose={onClose} title="Phân tích lại các bài cũ?">
      {nothingToDo ? (
        <p className="text-sm text-secondary">Không còn kết quả nào của chính sách cũ cần phân tích lại.</p>
      ) : preview ? (
        <p className="text-sm text-secondary">
          {fmt(preview.marked)} kết quả sẽ được đánh dấu cũ; tối đa {fmt(preview.cap)} bài sẽ được phân tích lại ngay.
          {preview.marked > preview.cap
            ? " Các bài vượt giới hạn này giữ trạng thái cũ cho tới lần phân tích lại hàng loạt tiếp theo."
            : null}
        </p>
      ) : (
        <p className="text-sm text-secondary">
          {fmt(outdatedCount)} bài đã được phân tích bằng chính sách cũ. Phân tích lại ngay?
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-error-primary">
          {errorText(error)}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        {terminal ? (
          <Button color="secondary" onClick={onClose}>
            Đóng
          </Button>
        ) : (
          <>
            <Button color="secondary" onClick={onClose}>
              {preview ? "Huỷ" : "Để sau"}
            </Button>
            <Button
              isLoading={m.isPending}
              isDisabled={m.isPending || rateLimited}
              onClick={() => run(preview === null)}
            >
              {preview ? "Xác nhận" : "Phân tích lại"}
            </Button>
          </>
        )}
      </div>
    </SettingsDialog>
  );
}
