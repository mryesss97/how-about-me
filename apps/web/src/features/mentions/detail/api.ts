"use client";

import {
  MentionDetailSchema,
  ReanalyzeResponseSchema,
  type MentionDetail,
  type ProjectSettings,
  type UserRole,
} from "@how-about-me/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

/** Poll interval while the current analysis is still running, so the banner and badges update by themselves. */
export const DETAIL_POLL_MS = 5_000;

export const isInFlight = (status: string | undefined) => status === "pending" || status === "processing";

/** GET /projects/:pid/mentions/:mentionId (FR-154). Polls while the analysis is pending/processing. */
export function useMentionDetail(pid: string | null | undefined, id: string) {
  return useQuery({
    queryKey: qk.mention(pid ?? "", id),
    queryFn: async () => MentionDetailSchema.parse(await apiFetch<unknown>(`/projects/${pid}/mentions/${id}`)),
    staleTime: staleTimes.mentions,
    enabled: !!pid && !!id,
    refetchInterval: (q) => (isInFlight(q.state.data?.analysis.status) ? DETAIL_POLL_MS : false),
  });
}

/**
 * FR-155 / BR-033: admin always; analyst only when the project allows it; viewer never.
 * UX gating only — the server enforces the same rule (@Roles + @AllowRoleWhenSetting, FR-015).
 */
export function canReanalyze(role: UserRole | null, settings: Pick<ProjectSettings, "allowAnalystReanalyze"> | null) {
  if (role === "admin") return true;
  return role === "analyst" && settings?.allowAnalystReanalyze === true;
}

/**
 * POST /projects/:pid/mentions/:mentionId/reanalyze (FR-155, BR-024: append-only, a new pending run).
 * Also backs the banner "Retry" until `POST …/analysis-runs/:id/retry` exists in the API.
 */
export function useReanalyze(pid: string | null | undefined, id: string) {
  const qc = useQueryClient();
  const key = qk.mention(pid ?? "", id);
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["project", pid ?? "", "mentions"] }),
    ]);
  return useMutation({
    mutationFn: async () =>
      ReanalyzeResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/mentions/${id}/reanalyze`, { method: "POST" }),
      ),
    onSuccess: () => {
      qc.setQueryData<MentionDetail>(key, (old) =>
        old ? { ...old, analysis: { ...old.analysis, status: "pending", errorCode: null } } : old,
      );
      toast.success("Re-analysis queued");
      void refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === "ANALYSIS_ALREADY_PENDING") {
        toast.info("Analysis is already pending for this mention");
        void refresh();
        return;
      }
      const msg = err instanceof ApiError ? err.message : "Could not queue re-analysis";
      toast.error(msg, {
        description: err instanceof ApiError && err.requestId ? `Request ID: ${err.requestId}` : undefined,
      });
    },
  });
}
