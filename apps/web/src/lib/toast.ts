import { toast, type ExternalToast } from "sonner";

/** Visible prefix of every error toast (#348, BR-017: the word, not only the red rule, says it failed). */
export const ERROR_TOAST_PREFIX = "Lỗi: ";

/** Error toast: "Lỗi: <message>"; `description` and `id` pass through unchanged. */
export function notifyError(message: string, options?: ExternalToast) {
  const title = `${ERROR_TOAST_PREFIX}${message}`;
  return options ? toast.error(title, options) : toast.error(title);
}
