"use client";

import { ListeningQueryPageSchema } from "@how-about-me/contracts";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { apiFetch } from "@/lib/api/client";
import { integrationErrorMessage, useVerifyThreads } from "./api";

export const NEW_QUERY_HREF = "/listening-queries?new=1";
const OK_MESSAGE = "Kết nối Threads hoạt động";

/**
 * True when the project has no enabled, live listening query. Only the first page is read: a page with items but
 * a next cursor may hide enabled queries further on, so "none" is claimed only when page 1 is empty or complete.
 */
async function hasNoEnabledQuery(pid: string): Promise<boolean> {
  const page = ListeningQueryPageSchema.parse(
    await apiFetch<unknown>(`/projects/${pid}/listening-queries`, {
      params: { includeDeleted: "false", limit: "200" },
    }),
  );
  if (page.items.length === 0) return true;
  return !page.nextCursor && !page.items.some((q) => q.enabled && !q.deletedAt);
}

/**
 * #346 flows-9: verify the Threads connection; on a healthy result with no enabled query, the success toast links
 * to creating the first one. Pass a toast id to replace an existing toast (e.g. the "đang kiểm tra" loading toast).
 */
export function useVerifyWithNextStep(pid: string) {
  const verify = useVerifyThreads(pid);
  const router = useRouter();
  const { mutate } = verify;
  const run = useCallback(
    (toastId?: string | number) =>
      mutate(undefined, {
        onSuccess: async (s) => {
          let empty = false;
          if (s.status === "connected") {
            // A failed list fetch must not block the success message.
            empty = await hasNoEnabledQuery(pid).catch(() => false);
          }
          toast.success(OK_MESSAGE, {
            id: toastId,
            action: empty
              ? { label: "Thêm truy vấn theo dõi →", onClick: () => router.push(NEW_QUERY_HREF) }
              : undefined,
          });
        },
        onError: (err) => notifyError(integrationErrorMessage(err), { id: toastId }),
      }),
    [mutate, pid, router],
  );
  return { run, isPending: verify.isPending };
}
