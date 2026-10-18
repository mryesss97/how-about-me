"use client";

import {
  CreateOverrideBodySchema,
  MentionDetailSchema,
  OverrideSchema,
  type CreateOverrideBody,
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
      // BR-040: a new run reopens a reviewed item.
      qc.invalidateQueries({ queryKey: ["project", pid ?? "", "reviews"] }),
      qc.invalidateQueries({ queryKey: qk.reviewCount(pid ?? "") }),
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
      toast.success("Đã xếp hàng phân tích lại");
      void refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.code === "ANALYSIS_ALREADY_PENDING") {
        toast.info("Bài nhắc này đang chờ phân tích");
        void refresh();
        return;
      }
      const msg = err instanceof ApiError ? err.message : "Không thể xếp hàng phân tích lại";
      toast.error(msg, {
        description: err instanceof ApiError && err.requestId ? `Mã yêu cầu: ${err.requestId}` : undefined,
      });
    },
  });
}

/** FR-191: admin and analyst may override. UX gating only — the server enforces `@Roles` (FR-015). */
export const canOverride = (role: UserRole | null) => role === "admin" || role === "analyst";

/** Detail, list, analytics and the review queue all read effective values (FR-192, BR-025), so all go stale. */
function useOverrideRefresh(pid: string | null | undefined, id: string) {
  const qc = useQueryClient();
  const p = pid ?? "";
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.mention(p, id) }),
      qc.invalidateQueries({ queryKey: ["project", p, "mentions"] }),
      qc.invalidateQueries({ queryKey: ["project", p, "analytics"] }),
      // FR-195: an override can move the item out of (or between) review tabs.
      qc.invalidateQueries({ queryKey: ["project", p, "reviews"] }),
      // #345: sidebar "Cần xem lại" plate.
      qc.invalidateQueries({ queryKey: qk.reviewCount(p) }),
    ]);
}

function overrideError(fallback: string, refresh: () => Promise<unknown>) {
  return (err: unknown) => {
    if (err instanceof ApiError && err.code === "OVERRIDE_CONFLICT") {
      toast.info("Có ghi đè khác vừa được lưu cùng lúc");
      void refresh();
      return;
    }
    const msg = err instanceof ApiError ? err.message : fallback;
    toast.error(msg, {
      description: err instanceof ApiError && err.requestId ? `Mã yêu cầu: ${err.requestId}` : undefined,
    });
  };
}

/** POST /projects/:pid/mentions/:mentionId/overrides (FR-191). Server revokes any active override on the same field. */
export function useCreateOverride(pid: string | null | undefined, id: string) {
  const refresh = useOverrideRefresh(pid, id);
  return useMutation({
    mutationFn: async (body: CreateOverrideBody) => {
      if (!pid) throw new Error("No project selected");
      return OverrideSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/mentions/${id}/overrides`, {
          method: "POST",
          body: JSON.stringify(CreateOverrideBodySchema.parse(body)),
        }),
      );
    },
    onSuccess: () => {
      toast.success("Đã lưu ghi đè");
      void refresh();
    },
    onError: overrideError("Không lưu được ghi đè", refresh),
  });
}

/** DELETE /projects/:pid/mentions/:mentionId/overrides/:overrideId (FR-193: history is kept). */
export function useRevokeOverride(pid: string | null | undefined, id: string) {
  const refresh = useOverrideRefresh(pid, id);
  return useMutation({
    mutationFn: async (overrideId: string) => {
      if (!pid) throw new Error("No project selected");
      await apiFetch<unknown>(`/projects/${pid}/mentions/${id}/overrides/${overrideId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Đã thu hồi ghi đè");
      void refresh();
    },
    onError: overrideError("Không thu hồi được ghi đè", refresh),
  });
}
