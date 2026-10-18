"use client";

import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { Button } from "@/components/base/buttons/button";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { integrationErrorMessage, useDisconnectThreads } from "./api";

/** FR-043: confirm before removing the Threads token. */
export function DisconnectDialog({ pid, isOpen, onClose }: { pid: string; isOpen: boolean; onClose: () => void }) {
  const disconnect = useDisconnectThreads(pid);
  const confirm = () => {
    onClose();
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success("Đã ngắt kết nối Threads"),
      onError: (err) => notifyError(integrationErrorMessage(err)),
    });
  };
  return (
    <SettingsDialog isOpen={isOpen} onClose={onClose} title="Ngắt kết nối Threads?">
      <p className="text-sm text-tertiary">Token sẽ bị xoá, việc thu thập dừng lại.</p>
      <div className="flex justify-end gap-3">
        <Button color="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button color="primary-destructive" onClick={confirm}>
          Ngắt kết nối
        </Button>
      </div>
    </SettingsDialog>
  );
}
