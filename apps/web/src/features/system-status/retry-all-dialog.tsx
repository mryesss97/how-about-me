"use client";

import { toast } from "sonner";
import { Button } from "@/components/base/buttons/button";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { formatCount } from "@/lib/format/number";
import { RETRY_ALL_LIMIT, retryErrorMessage, useRetryAllFailedAnalysis } from "./api";

/** FR-175 / BR-024 / TC-SYS-012: confirm before re-queuing up to 500 failed analysis runs (admin). */
export function RetryAllDialog({
  pid,
  total,
  isOpen,
  onClose,
}: {
  pid: string;
  /** #343: total failed runs (from `count=true`); the server retries only the latest per post (BR-024). */
  total?: number;
  isOpen: boolean;
  onClose: () => void;
}) {
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
        {total != null
          ? `Có ${formatCount(total)} lượt lỗi. Hệ thống sẽ xếp lịch phân tích lại tối đa ${formatCount(Math.min(total, RETRY_ALL_LIMIT))} lượt, mỗi bài một lượt (bỏ qua bài đang có lượt chờ).`
          : `Xếp lịch phân tích lại tối đa ${formatCount(RETRY_ALL_LIMIT)} lượt lỗi? Nếu còn nhiều hơn, hãy thực hiện lại sau.`}
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
