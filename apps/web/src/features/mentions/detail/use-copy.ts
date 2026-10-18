"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";

/** Copies text and reports via toast (TC-MEN-019). Clipboard needs a secure context; failures show an error toast. */
export function useCopy() {
  return useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã sao chép ${label}`);
    } catch {
      notifyError(`Không sao chép được ${label}`);
    }
  }, []);
}
