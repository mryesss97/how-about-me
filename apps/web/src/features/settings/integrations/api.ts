"use client";

import {
  PutThreadsIntegrationBodySchema,
  ThreadsIntegrationStatusSchema,
  type PutThreadsIntegrationBody,
  type ThreadsIntegrationStatus,
} from "@how-about-me/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessageVi } from "@/lib/semantics/api-errors";
import { ApiError, apiFetch } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";

const path = (pid: string) => `/projects/${pid}/integrations/threads`;

/** Code → Vietnamese copy for Threads integration errors; unknown codes keep message + requestId. */
export function integrationErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  switch (err.code) {
    case "INTEGRATION_NOT_CONFIGURED":
      return "Chưa có token. Cập nhật token trước.";
    case "THREADS_UNAUTHORIZED":
      return "Token không hợp lệ hoặc đã hết hạn.";
    case "THREADS_FORBIDDEN":
      return "Token thiếu quyền cần thiết trên Threads.";
    case "THREADS_UPSTREAM_ERROR":
    case "THREADS_MALFORMED_RESPONSE":
      return "Threads trả về lỗi. Vui lòng thử lại sau.";
    case "THREADS_RATE_LIMITED":
      return "Threads đang giới hạn tần suất. Vui lòng thử lại sau.";
    case "THREADS_TIMEOUT":
      return "Threads không phản hồi kịp. Vui lòng thử lại.";
    case "VALIDATION_ERROR":
      return "Dữ liệu không hợp lệ.";
    case "FORBIDDEN_ROLE":
    case "FORBIDDEN_PROJECT":
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return err.requestId ? `${apiErrorMessageVi(err)} (Mã yêu cầu: ${err.requestId})` : apiErrorMessageVi(err);
  }
}

/** FR-044 */
export function useThreadsIntegration(pid: string) {
  return useQuery({
    queryKey: qk.integration(pid),
    queryFn: async () => ThreadsIntegrationStatusSchema.parse(await apiFetch<unknown>(path(pid))),
  });
}

function useRefresh(pid: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.integration(pid) });
    // System Status shows Threads health too.
    void qc.invalidateQueries({ queryKey: qk.systemStatus(pid) });
  };
}

/** FR-043: PUT stores the token without verifying → status comes back `disconnected`. */
export function useUpdateThreadsToken(pid: string) {
  const qc = useQueryClient();
  const refresh = useRefresh(pid);
  return useMutation({
    mutationFn: async (body: PutThreadsIntegrationBody) =>
      ThreadsIntegrationStatusSchema.parse(
        await apiFetch<unknown>(path(pid), {
          method: "PUT",
          body: JSON.stringify(PutThreadsIntegrationBodySchema.parse(body)),
        }),
      ),
    onSuccess: (s) => qc.setQueryData(qk.integration(pid), s),
    onSettled: refresh,
  });
}

/** FR-043/FR-044: a failed verify has already committed the new status server-side → always refetch. */
export function useVerifyThreads(pid: string) {
  const qc = useQueryClient();
  const refresh = useRefresh(pid);
  return useMutation({
    mutationFn: async () =>
      ThreadsIntegrationStatusSchema.parse(await apiFetch<unknown>(`${path(pid)}/verify`, { method: "POST" })),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qk.integration(pid) });
    },
    onSuccess: (s) => qc.setQueryData(qk.integration(pid), s),
    onSettled: refresh,
  });
}

/** FR-043: optimistic `disconnected`; lastSuccessAt is kept (API design §4). Rolls back on error. */
export function useDisconnectThreads(pid: string) {
  const qc = useQueryClient();
  const refresh = useRefresh(pid);
  return useMutation({
    mutationFn: async () => {
      await apiFetch<void>(path(pid), { method: "DELETE" });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qk.integration(pid) });
      const prev = qc.getQueryData<ThreadsIntegrationStatus>(qk.integration(pid));
      if (prev)
        qc.setQueryData<ThreadsIntegrationStatus>(qk.integration(pid), {
          ...prev,
          status: "disconnected",
          accountIdentifier: null,
          grantedScopes: [],
          tokenExpiresAt: null,
          lastVerifiedAt: null,
          lastError: null,
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.integration(pid), ctx.prev);
    },
    onSettled: refresh,
  });
}
