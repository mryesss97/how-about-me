"use client";

import { AlertCircle, AlertTriangle, CheckCircle, InfoCircle } from "@untitledui/icons";
import { Toaster } from "sonner";

/**
 * #348: toasts are flat enamel plates (white, 2px ink border, 2px radius, no shadow), not sonner's rich colours.
 * Errors add a red left rule plus the word "Lỗi" (see `notifyError`) so colour is never the only signal (BR-017).
 */
export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      // Keep toasts above the iOS home indicator on phones.
      mobileOffset={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
      icons={{
        success: <CheckCircle aria-hidden className="size-5 text-[var(--ink)]" />,
        error: <AlertCircle aria-hidden className="size-5 text-[var(--red-enamel)]" />,
        info: <InfoCircle aria-hidden className="size-5 text-[var(--ink)]" />,
        warning: <AlertTriangle aria-hidden className="size-5 text-[var(--ink)]" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "enamel-toast",
          error: "enamel-toast--error",
          title: "enamel-toast-title",
          description: "enamel-toast-description",
          actionButton: "enamel-toast-action plaque-button inline-flex items-center px-2 py-1 text-xs",
          cancelButton: "enamel-toast-action plaque-button inline-flex items-center px-2 py-1 text-xs",
        },
      }}
    />
  );
}
