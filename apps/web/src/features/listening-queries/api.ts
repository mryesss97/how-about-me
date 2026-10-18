"use client";

import {
  BackfillBodySchema,
  CreateListeningQueryBodySchema,
  ListeningQueryPageSchema,
  ListeningQuerySchema,
  QueryDuplicateDetailsSchema,
  QueuedJobResponseSchema,
  RunQueryResponseSchema,
  SyncJobDetailSchema,
  UpdateListeningQueryBodySchema,
  type BackfillBody,
  type CreateListeningQueryBody,
  type UpdateListeningQueryBody,
} from "@how-about-me/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import { isRejectedCursor } from "@/lib/query/infinite-list";
import { qk, staleTimes } from "@/lib/query/keys";
import { isJobActive } from "./format";

export const QUERIES_PAGE_SIZE = 200;
/** #340 flows-6: list refetch interval while any loaded query has a queued/running last job. */
export const QUERIES_ACTIVE_POLL_MS = 5000;

/** GET /projects/:pid/listening-queries (FR-051). Soft-deleted queries are hidden unless `includeDeleted`. */
export function useListeningQueries(pid: string | null | undefined, opts: { includeDeleted: boolean }) {
  const qc = useQueryClient();
  const { includeDeleted } = opts;
  const queryKey = useMemo(() => qk.queries(pid ?? "", { includeDeleted }), [pid, includeDeleted]);
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      ListeningQueryPageSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/listening-queries`, {
          params: {
            includeDeleted: String(includeDeleted),
            limit: String(QUERIES_PAGE_SIZE),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: staleTimes.queries,
    enabled: !!pid,
    // Poll until the run ends so the row moves "Đang chờ" → "Thành công" by itself; off when the tab is hidden.
    refetchInterval: (q) =>
      q.state.data?.pages.some((p) => p.items.some(isJobActive)) ? QUERIES_ACTIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
  const { fetchNextPage: fetchNext } = query;
  // A stale/tampered cursor (400 on `cursor`, #195) restarts from the first page, same as Mentions.
  const fetchNextPage = useCallback(async () => {
    const res = await fetchNext();
    if (res.isFetchNextPageError && isRejectedCursor(res.error)) await qc.resetQueries({ queryKey, exact: true });
    return res;
  }, [fetchNext, qc, queryKey]);
  return { ...query, fetchNextPage };
}

/** GET …/listening-queries/:id — deep link `?edit=<id>` for a query outside the loaded list (#43). */
export function useListeningQuery(pid: string | null | undefined, id: string | null) {
  return useQuery({
    queryKey: ["project", pid ?? "", "listening-queries", "detail", id ?? ""] as const,
    queryFn: async () =>
      ListeningQuerySchema.parse(await apiFetch<unknown>(`/projects/${pid}/listening-queries/${id}`)),
    enabled: !!pid && !!id,
    staleTime: staleTimes.queries,
  });
}

/** User-facing Vietnamese message for a listening-query mutation error; unknown codes keep message + requestId. */
export function queryErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  if (err.status === 429 || err.code === "RATE_LIMITED") return "Thao tác quá nhanh, thử lại sau.";
  switch (err.code) {
    case "QUERY_DUPLICATE":
      return "Truy vấn này đã tồn tại.";
    case "SYNC_ALREADY_RUNNING":
      return "Truy vấn đang đồng bộ.";
    case "BACKFILL_WINDOW_INVALID":
      return "Khoảng thời gian không hợp lệ (tối đa 30 ngày, không vượt quá hiện tại).";
    case "QUERY_IMMUTABLE_FIELD":
      return "Không thể đổi giá trị hoặc loại truy vấn. Hãy tạo truy vấn mới.";
    case "FORBIDDEN_ROLE":
    case "FORBIDDEN_PROJECT":
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return err.requestId ? `${err.message} (Mã yêu cầu: ${err.requestId})` : err.message;
  }
}

/** FR-053 / BR-006: `details.existingId` of a 409 QUERY_DUPLICATE, else null. */
export function duplicateExistingId(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== "QUERY_DUPLICATE") return null;
  const d = QueryDuplicateDetailsSchema.safeParse(err.details);
  return d.success ? d.data.existingId : null;
}

/** FR-058: `details.jobId` of a 409 SYNC_ALREADY_RUNNING, else null. */
export function runningJobId(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== "SYNC_ALREADY_RUNNING") return null;
  const d = QueuedJobResponseSchema.pick({ jobId: true }).safeParse(err.details);
  return d.success ? d.data.jobId : null;
}

/** All list variants (`includeDeleted` on/off) share this prefix. */
const listPrefix = (pid: string) => ["project", pid, "listening-queries"] as const;

function useQueryMutation<TVars, TData>(pid: string, mutationFn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => qc.invalidateQueries({ queryKey: listPrefix(pid) }),
  });
}

const base = (pid: string) => `/projects/${pid}/listening-queries`;

/** POST (FR-052/053). */
export function useCreateListeningQuery(pid: string) {
  return useQueryMutation(pid, async (body: CreateListeningQueryBody) =>
    ListeningQuerySchema.parse(
      await apiFetch<unknown>(base(pid), {
        method: "POST",
        body: JSON.stringify(CreateListeningQueryBodySchema.parse(body)),
      }),
    ),
  );
}

/** PATCH changed fields only (FR-054); also used for enable/disable (FR-055). */
export function useUpdateListeningQuery(pid: string) {
  return useQueryMutation(pid, async ({ id, body }: { id: string; body: UpdateListeningQueryBody }) =>
    ListeningQuerySchema.parse(
      await apiFetch<unknown>(`${base(pid)}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(UpdateListeningQueryBodySchema.parse(body)),
      }),
    ),
  );
}

/** Soft delete (FR-057), 204. */
export function useDeleteListeningQuery(pid: string) {
  return useQueryMutation(pid, async (id: string) => {
    await apiFetch<unknown>(`${base(pid)}/${id}`, { method: "DELETE" });
  });
}

/** Restore a soft-deleted query (FR-057). */
export function useRestoreListeningQuery(pid: string) {
  return useQueryMutation(pid, async (id: string) =>
    ListeningQuerySchema.parse(await apiFetch<unknown>(`${base(pid)}/${id}/restore`, { method: "POST" })),
  );
}

/** Run now (FR-058): 202 `{ jobId, status: "queued" }`. */
export function useRunListeningQuery(pid: string) {
  return useQueryMutation(pid, async (id: string) =>
    RunQueryResponseSchema.parse(await apiFetch<unknown>(`${base(pid)}/${id}/run`, { method: "POST" })),
  );
}

/** Backfill a window (FR-063): 202 `{ jobId, status: "queued" }`; 409 SYNC_ALREADY_RUNNING when a job is active (BR-010). */
export function useBackfillListeningQuery(pid: string) {
  return useQueryMutation(pid, async ({ id, body }: { id: string; body: BackfillBody }) =>
    QueuedJobResponseSchema.parse(
      await apiFetch<unknown>(`${base(pid)}/${id}/backfill`, {
        method: "POST",
        body: JSON.stringify(BackfillBodySchema.parse(body)),
      }),
    ),
  );
}

export const BACKFILL_POLL_MS = 3000;

/**
 * GET …/sync-jobs/:id polled every 3 s while queued/running; stops at a terminal status, on unmount and when the tab
 * is hidden. Kept local (not imported from features/system-status) to avoid cross-feature coupling.
 */
export function useBackfillJobProgress(pid: string, jobId: string | null) {
  return useQuery({
    queryKey: [...qk.syncJobs(pid), "detail", jobId] as const,
    queryFn: async () => SyncJobDetailSchema.parse(await apiFetch<unknown>(`/projects/${pid}/sync-jobs/${jobId}`)),
    enabled: !!pid && !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "queued" || s === "running" ? BACKFILL_POLL_MS : false;
    },
    refetchIntervalInBackground: false,
  });
}

/** Invalidate the list so "Lần đồng bộ cuối" refreshes after a backfill ends. */
export function useInvalidateQueryList(pid: string) {
  const qc = useQueryClient();
  return useCallback(() => void qc.invalidateQueries({ queryKey: listPrefix(pid) }), [qc, pid]);
}
