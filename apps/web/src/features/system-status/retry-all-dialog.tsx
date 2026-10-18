"use client";

import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { formatCount } from "@/lib/format/number";
import { RETRY_ALL_LIMIT, retryErrorMessage, useRetryAllFailedAnalysis } from "./api";

/** FR-175 / BR-024 / TC-SYS-012: confirm before re-queuing up to 500 failed analysis runs (admin). */
export function RetryAllDialog({ pid, isOpen, onClose }: { pid: string; isOpen: boolean; onClose: () => void }) {
  const m = useRetryAllFailedAnalysis(pid);
  const confirm = () =>
    m.mutate(undefined, {
      onSuccess: (r) => {
        toast.success(`Đã xếp lịch ${formatCount(r.enqueued)} lượt phân tích`);
        onClose();
      },
      onError: (e) => toast.error(retryErrorMessage(e)),
    });

  return (
    <SettingsDialog isOpen={isOpen} onClose={onClose} title="Thử lại tất cả lỗi?">
      <p className="text-sm text-secondary">
        Xếp lịch phân tích lại tối đa {formatCount(RETRY_ALL_LIMIT)} lượt lỗi? Nếu còn nhiều hơn, hãy thực hiện lại sau.
      </p>
      <div className="flex justify-end gap-3">
        <Button color="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button isLoading={m.isPending} isDisabled={m.isPending} onClick={confirm}>
          Xác nhận
        </Button>
      </div>
    </SettingsDialog>
  );
}
