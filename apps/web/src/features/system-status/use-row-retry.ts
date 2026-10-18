"use client";

import { useState } from "react";
import { toast } from "sonner";
import { retryErrorMessage, useRetryAnalysisRun } from "./api";

/** FR-175: per-row analysis retry; every row with a retry in flight stays disabled (shared by table + cards). */
export function useRowRetry(pid: string) {
  const retry = useRetryAnalysisRun(pid);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const onRetry = (id: string) => {
    setBusyIds((prev) => new Set(prev).add(id));
    retry.mutate(id, {
      onSuccess: () => toast.success("Đã xếp lịch thử lại"),
      onError: (e) => toast.error(retryErrorMessage(e)),
      onSettled: () =>
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  };
  return { busyIds, onRetry };
}
