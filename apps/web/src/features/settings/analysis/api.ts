"use client";

import {
  AnalysisSettingsSchema,
  UpdateAnalysisSettingsBodySchema,
  type AnalysisSettings,
  type UpdateAnalysisSettingsBody,
} from "@how-about-me/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
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
