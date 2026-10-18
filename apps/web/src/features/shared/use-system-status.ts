"use client";

import { SystemStatusResponseSchema } from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk, staleTimes } from "@/lib/query/keys";

/** FR-170: the System Status overview auto-refreshes every 30 s while the browser tab is visible (TC-SYS-001). */
export const SYSTEM_STATUS_REFETCH_MS = 30_000;

/**
 * GET /projects/:pid/system-status (FR-170, open to every role). `poll: true` = the System Status page (30 s);
 * default = the shell health strip / sidebar dot (#345, stale 60 s, no polling). Same key → one shared cache.
 */
export function useSystemStatus(pid: string | null | undefined, opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: qk.systemStatus(pid ?? ""),
    queryFn: async () => SystemStatusResponseSchema.parse(await apiFetch<unknown>(`/projects/${pid}/system-status`)),
    ...(opts.poll
      ? {
          refetchInterval: SYSTEM_STATUS_REFETCH_MS,
          refetchIntervalInBackground: false,
          staleTime: staleTimes.systemStatus,
        }
      : { staleTime: staleTimes.shellHealth }),
    enabled: !!pid,
  });
}
