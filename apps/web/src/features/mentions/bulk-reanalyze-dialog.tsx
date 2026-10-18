"use client";

import type { BulkReanalyzeResponse, UserRole } from "@how-about-me/contracts";
import { RefreshCw01 } from "@untitledui/icons";
import { useEffect, useState } from "react";
import { Heading as AriaHeading } from "react-aria-components";
import { toast } from "sonner";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { ApiError } from "@/lib/api/client";
import { retryAfterSeconds, waitTextVi } from "@/lib/api/rate-limit";
import { formatCount } from "@/lib/format/number";
import { useBulkReanalyze } from "./api";

const TITLE = "Phân tích lại các bài nhắc?";

/** personas §3: admin only, even with `allowAnalystReanalyze` — UX only, the API enforces it (FR-015). */
export function canBulkReanalyze(role: UserRole | null): boolean {
  return role === "admin";
}

function errorText(err: unknown): string {
  if (err instanceof ApiError && err.code === "RATE_LIMITED")
    return `Vừa có yêu cầu phân tích lại. Thử lại sau ${waitTextVi(retryAfterSeconds(err))}.`;
  if (err instanceof ApiError && err.code === "FORBIDDEN_ROLE") return "Bạn không có quyền phân tích lại.";
  const rid = err instanceof ApiError && err.requestId ? ` (mã yêu cầu ${err.requestId})` : "";
  return `Không thể bắt đầu phân tích lại${rid}.`;
}

/**
 * T-146 / FR-196: previews (`dryRun=true`) on mount with the `params` snapshot taken when opened, then Confirm
 * runs the same filters for real. Mounted only while open, so closing resets the state.
 */
export function BulkReanalyzeDialog({
  pid,
  params,
  onClose,
}: {
  pid: string;
  params: Record<string, string>;
  onClose: () => void;
}) {
  const m = useBulkReanalyze(pid);
  const [preview, setPreview] = useState<BulkReanalyzeResponse | null>(null);
  const { mutate } = m;

  const run = (dryRun: boolean) =>
    mutate(
      { params, dryRun },
      {
        onSuccess: (r) => {
          if (dryRun) return setPreview(r);
          // BR-024: enqueued can be below min(matched, cap) — current or pending runs are skipped.
          toast.success(
            r.enqueued > 0
              ? `Đã xếp hàng phân tích lại ${formatCount(r.enqueued)} bài`
              : "Không có bài nào cần phân tích lại",
          );
          onClose();
        },
      },
    );

  useEffect(() => {
    // One dry run on open with the snapshot; `params` is fixed for the dialog's lifetime.
    mutate({ params, dryRun: true }, { onSuccess: setPreview });
  }, [mutate, params]);

  const error = m.error;
  const previewFailed = m.isError && m.variables?.dryRun === true;
  const rateLimited = error instanceof ApiError && error.code === "RATE_LIMITED";
  // Nothing matched: a real call would only use the project's 5-minute bulk window (FR-196).
  const nothingToDo = preview !== null && preview.matched === 0;

  return (
    <ModalOverlay isOpen onOpenChange={(o) => !o && onClose()} isDismissable>
      <Modal className="max-w-md">
        <Dialog aria-label={TITLE}>
          <div className="flex w-full flex-col gap-4 rounded-xl bg-primary p-6 shadow-xl">
            <AriaHeading slot="title" className="text-lg font-semibold text-primary">
              {TITLE}
            </AriaHeading>
            {nothingToDo ? (
              <p className="text-sm text-secondary">Không có bài nhắc nào khớp bộ lọc hiện tại.</p>
            ) : preview ? (
              <p className="text-sm text-secondary">
                {formatCount(preview.matched)} bài nhắc khớp bộ lọc hiện tại. Tối đa {formatCount(preview.cap)} bài sẽ
                được phân tích lại ngay; bài đã có kết quả hiện hành hoặc đang chờ sẽ được bỏ qua.
                {preview.matched > preview.cap ? " Thu hẹp bộ lọc để phân tích lại phần còn lại." : null}
              </p>
            ) : !previewFailed ? (
              <p className="text-sm text-tertiary" aria-busy="true">
                Đang đếm bài nhắc khớp…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-error-primary">
                {errorText(error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              {nothingToDo ? (
                <Button color="secondary" onClick={onClose}>
                  Đóng
                </Button>
              ) : (
                <>
                  <Button color="secondary" onClick={onClose}>
                    Huỷ
                  </Button>
                  {previewFailed && !rateLimited ? (
                    <Button isLoading={m.isPending} isDisabled={m.isPending} onClick={() => run(true)}>
                      Thử lại
                    </Button>
                  ) : (
                    <Button
                      isLoading={m.isPending}
                      isDisabled={m.isPending || rateLimited || preview === null}
                      onClick={() => run(false)}
                    >
                      Xác nhận
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Toolbar action on /mentions (UX §3.3, T-146). Render only when `canBulkReanalyze`. */
export function BulkReanalyzeButton({ pid, params }: { pid: string; params: Record<string, string> }) {
  // Snapshot of the pinned list params at open time: filter changes while open do not alter the run.
  const [snapshot, setSnapshot] = useState<Record<string, string> | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setSnapshot(params)}
        className="plaque-button inline-flex min-h-11 md:min-h-0 items-center gap-2 px-3 py-1.5 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <RefreshCw01 className="size-4" aria-hidden />
        Phân tích lại
      </button>
      {snapshot ? <BulkReanalyzeDialog pid={pid} params={snapshot} onClose={() => setSnapshot(null)} /> : null}
    </>
  );
}
