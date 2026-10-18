"use client";

import type { ListeningQuery } from "@how-about-me/contracts";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import {
  queryErrorMessage,
  runningJobId,
  useDeleteListeningQuery,
  useRestoreListeningQuery,
  useRunListeningQuery,
  useUpdateListeningQuery,
} from "./api";
import { jobHref } from "./format";

/** Row mutations with their toasts (FR-055, FR-057, FR-058). API enforces `@Roles("admin")`; 403 maps to a toast. */
export function useQueryActions(pid: string) {
  const router = useRouter();
  const run = useRunListeningQuery(pid);
  const update = useUpdateListeningQuery(pid);
  const remove = useDeleteListeningQuery(pid);
  const restore = useRestoreListeningQuery(pid);
  const jobAction = (jobId: string) => ({ label: "Xem lượt đồng bộ", onClick: () => router.push(jobHref(jobId)) });

  const onRestore = (q: ListeningQuery) =>
    restore.mutate(q.id, {
      onSuccess: () => toast.success("Đã khôi phục truy vấn"),
      onError: (err) => notifyError(queryErrorMessage(err)),
    });

  return {
    /** Row id with a pending enable/disable, so its toggle is disabled. */
    togglingId: update.isPending ? update.variables?.id : undefined,
    runningId: run.isPending ? run.variables : undefined,
    onRun: (q: ListeningQuery) => {
      // A second click while the same run is being queued would only produce a 409 toast.
      if (run.isPending && run.variables === q.id) return;
      run.mutate(q.id, {
        // TC-LQ-013: 202 → toast with a link to the job.
        onSuccess: (res) => toast.success("Đã xếp lịch đồng bộ", { action: jobAction(res.jobId) }),
        onError: (err) => {
          const jobId = runningJobId(err);
          notifyError(queryErrorMessage(err), jobId ? { action: jobAction(jobId) } : undefined);
        },
      });
    },
    onToggle: (q: ListeningQuery) =>
      update.mutate(
        { id: q.id, body: { enabled: !q.enabled } },
        {
          onSuccess: (res) => toast.success(res.enabled ? "Đã bật truy vấn" : "Đã tắt truy vấn"),
          onError: (err) => notifyError(queryErrorMessage(err)),
        },
      ),
    onConfirmDelete: (q: ListeningQuery) =>
      remove.mutate(q.id, {
        onSuccess: () =>
          toast.success("Đã xoá truy vấn", { action: { label: "Hoàn tác", onClick: () => onRestore(q) } }),
        onError: (err) => notifyError(queryErrorMessage(err)),
      }),
    onRestore,
  };
}
