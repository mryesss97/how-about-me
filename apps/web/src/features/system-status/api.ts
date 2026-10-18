"use client";

import {
  ListeningQueryPageSchema,
  RetrySyncJobResponseSchema,
  SyncJobDetailSchema,
  SyncJobsPageSchema,
  SystemStatusResponseSchema,
  type JobStatus,
} from "@how-about-me/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

/** FR-170: the overview auto-refreshes every 30 s while the browser tab is visible (TC-SYS-001). */
export const SYSTEM_STATUS_REFETCH_MS = 30_000;
export const SYNC_JOBS_PAGE_SIZE = 50;

export type SyncJobFilters = { queryId?: string; status?: JobStatus; from?: string; to?: string };

export function useSystemStatus(pid: string | null | undefined) {
  return useQuery({
    queryKey: qk.systemStatus(pid ?? ""),
    queryFn: async () => SystemStatusResponseSchema.parse(await apiFetch<unknown>(`/projects/${pid}/system-status`)),
    refetchInterval: SYSTEM_STATUS_REFETCH_MS,
    refetchIntervalInBackground: false,
    staleTime: staleTimes.systemStatus,
    enabled: !!pid,
  });
}

/** FR-081: cursor-paginated sync job list; `from`/`to` are already UTC ISO strings. */
export function useSyncJobs(pid: string | null | undefined, filters: SyncJobFilters) {
  return useInfiniteQuery({
    queryKey: qk.syncJobs(pid ?? "", filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      SyncJobsPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/sync-jobs`, {
          params: {
            limit: String(SYNC_JOBS_PAGE_SIZE),
            queryId: filters.queryId,
            status: filters.status,
            from: filters.from,
            to: filters.to,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!pid,
  });
}

export function useSyncJob(pid: string | null | undefined, jobId: string | null) {
  return useQuery({
    queryKey: [...qk.syncJobs(pid ?? ""), "detail", jobId] as const,
    queryFn: async () => SyncJobDetailSchema.parse(await apiFetch<unknown>(`/projects/${pid}/sync-jobs/${jobId}`)),
    enabled: !!pid && !!jobId,
  });
}

/** FR-175: admin-only retry of a failed job (server enforces `@Roles("admin")`, FR-015). */
export function useRetrySyncJob(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) =>
      RetrySyncJobResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/sync-jobs/${jobId}/retry`, { method: "POST" }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["project", pid, "sync-jobs"] });
      void qc.invalidateQueries({ queryKey: qk.systemStatus(pid) });
    },
  });
}

export function retryErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  switch (err.code) {
    case "SYNC_JOB_NOT_RETRYABLE":
      return "Lượt đồng bộ này không thể thử lại.";
    case "FORBIDDEN_ROLE":
    case "FORBIDDEN_PROJECT":
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return err.requestId ? `${err.message} (Mã yêu cầu: ${err.requestId})` : err.message;
  }
}

/**
 * Query id → display name for the filter and the "Truy vấn" column (incl. deleted queries, first 200).
 * Own key suffix: feature folders must not import `listening-queries` (frontend-design §1).
 */
export function useQueryNames(pid: string | null | undefined) {
  const q = useQuery({
    queryKey: [...qk.queries(pid ?? "", { includeDeleted: true }), "names"] as const,
    queryFn: async () =>
      ListeningQueryPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/listening-queries`, {
          params: { includeDeleted: "true", limit: "200" },
        }),
      ),
    staleTime: staleTimes.queries,
    enabled: !!pid,
  });
  return useMemo(() => (q.data?.items ?? []).map((x) => ({ id: x.id, name: x.displayName })), [q.data]);
}
