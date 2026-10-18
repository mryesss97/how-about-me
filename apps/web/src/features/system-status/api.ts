"use client";

import {
  AnalysisRunsPageSchema,
  AuditLogsPageSchema,
  ListeningQueryPageSchema,
  RetryAnalysisRunResponseSchema,
  RetryFailedBodySchema,
  RetryFailedResponseSchema,
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
export const ANALYSIS_FAILURES_PAGE_SIZE = 50;
export const AUDIT_LOGS_PAGE_SIZE = 50;
/** FR-175: "retry all failed" re-queues at most 500 runs per call (contract max). */
export const RETRY_ALL_LIMIT = 500;

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

export type AuditLogFilters = { action?: string; from?: string; to?: string };

/** FR-201: admin-only audit log list; only fires when `enabled` (caller is admin) to avoid a 403 (TC-SYS-015). */
export function useAuditLogs(pid: string | null | undefined, filters: AuditLogFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: qk.auditLogs(pid ?? "", filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      AuditLogsPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/audit-logs`, {
          params: {
            limit: String(AUDIT_LOGS_PAGE_SIZE),
            action: filters.action,
            from: filters.from,
            to: filters.to,
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!pid && enabled,
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

/** FR-175: failed analysis runs, newest first (GET is open to every member). */
export function useFailedAnalysisRuns(pid: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: qk.analysisRuns(pid ?? "", { status: "failed" }),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      AnalysisRunsPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/analysis-runs`, {
          params: {
            status: "failed",
            limit: String(ANALYSIS_FAILURES_PAGE_SIZE),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!pid,
  });
}

function useInvalidateAnalysis(pid: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["project", pid, "analysis-runs"] });
    void qc.invalidateQueries({ queryKey: qk.systemStatus(pid) });
  };
}

/** FR-175 / BR-024: admin retry of one failed run in place (server enforces `@Roles("admin")`, FR-015). */
export function useRetryAnalysisRun(pid: string) {
  const invalidate = useInvalidateAnalysis(pid);
  return useMutation({
    mutationFn: async (runId: string) =>
      RetryAnalysisRunResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/analysis-runs/${runId}/retry`, { method: "POST" }),
      ),
    onSuccess: invalidate,
  });
}

/** FR-175 / BR-024: admin re-queues up to 500 failed runs (TC-SYS-012). */
export function useRetryAllFailedAnalysis(pid: string) {
  const invalidate = useInvalidateAnalysis(pid);
  return useMutation({
    mutationFn: async () =>
      RetryFailedResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/analysis-runs/retry-failed`, {
          method: "POST",
          body: JSON.stringify(RetryFailedBodySchema.parse({ limit: RETRY_ALL_LIMIT })),
        }),
      ),
    onSuccess: invalidate,
  });
}

export function retryErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  switch (err.code) {
    case "SYNC_JOB_NOT_RETRYABLE":
      return "Lượt đồng bộ này không thể thử lại.";
    case "ANALYSIS_RUN_NOT_RETRYABLE":
      return "Lượt phân tích này không còn ở trạng thái lỗi.";
    case "ANALYSIS_ALREADY_PENDING":
      return "Bài này đã có lượt phân tích đang chờ.";
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
