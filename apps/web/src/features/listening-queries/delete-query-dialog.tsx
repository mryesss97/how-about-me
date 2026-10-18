"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { Button } from "@/components/base/buttons/button";
import { SettingsDialog } from "@/features/shared/settings-dialog";

/** FR-057: confirm a soft delete; the view runs the mutation and the toasts. */
export function DeleteQueryDialog({
  query,
  onClose,
  onConfirm,
}: {
  query: ListeningQuery | null;
  onClose: () => void;
  onConfirm: (q: ListeningQuery) => void;
}) {
  return (
    <SettingsDialog isOpen={!!query} onClose={onClose} title="Xoá truy vấn?">
      <p className="text-sm text-tertiary">
        {query ? <strong className="text-secondary">{query.displayName}</strong> : null} sẽ ngừng thu thập. Bài nhắc và
        lịch sử vẫn được giữ; có thể khôi phục từ “Hiện truy vấn đã xoá”.
      </p>
      <div className="flex justify-end gap-3">
        <Button color="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button color="primary-destructive" onClick={() => query && onConfirm(query)}>
          Xoá
        </Button>
      </div>
    </SettingsDialog>
  );
}
