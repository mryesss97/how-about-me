"use client";

import {
  AnalysisSettingsSchema,
  MarkStaleQuerySchema,
  MarkStaleResponseSchema,
  type MarkStaleResponse,
  UpdateAnalysisSettingsBodySchema,
  type AnalysisSettings,
  type UpdateAnalysisSettingsBody,
} from "@how-about-me/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, apiFetch } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";

const path = (pid: string) => `/projects/${pid}/settings/analysis`;

/** FR-190: active analysis policy + current versions (any member). */
export function useAnalysisSettings(pid: string) {
  return useQuery({
    queryKey: qk.analysisSettings(pid),
    queryFn: async () => AnalysisSettingsSchema.parse(await apiFetch<unknown>(path(pid))),
  });
}

/** FR-190 / BR-023: admin PATCH creates a new policy version; the response replaces the cached settings. */
export function useUpdateAnalysisSettings(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateAnalysisSettingsBody): Promise<AnalysisSettings> =>
      AnalysisSettingsSchema.parse(
        await apiFetch<unknown>(path(pid), {
          method: "PATCH",
          body: JSON.stringify(UpdateAnalysisSettingsBodySchema.parse(body)),
        }),
      ),
    onSuccess: (data) => qc.setQueryData(qk.analysisSettings(pid), data),
  });
}

/**
 * FR-196 / BR-023: mark results of an older `effectiveVersion` stale and enqueue up to `cap` posts.
 * Admin only (server enforces `@Roles("admin")`, FR-015). `dryRun` previews counts without changes.
 */
export function useMarkStale(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (query: { version: string; dryRun: boolean }): Promise<MarkStaleResponse> => {
      const q = MarkStaleQuerySchema.parse(query);
      return MarkStaleResponseSchema.parse(
        await apiFetch<unknown>(`/projects/${pid}/analysis-runs/mark-stale`, {
          method: "POST",
          params: { version: q.version, dryRun: q.dryRun },
        }),
      );
    },
    onSuccess: (_data, vars) => {
      if (!vars.dryRun) void qc.invalidateQueries({ queryKey: qk.analysisSettings(pid) });
    },
  });
}

const RetryAfterDetailsSchema = z.object({ retryAfterSeconds: z.number().nonnegative() });

/** Seconds to wait from a `429 RATE_LIMITED` error (`details.retryAfterSeconds`), else null. */
export function retryAfterSeconds(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.code !== "RATE_LIMITED") return null;
  const parsed = RetryAfterDetailsSchema.safeParse(err.details);
  return parsed.success ? parsed.data.retryAfterSeconds : null;
}
