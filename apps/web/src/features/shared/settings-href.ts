"use client";

import { ThreadsIntegrationStatusSchema, type IntegrationStatus, type UserRole } from "@how-about-me/contracts";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { tokenExpiryState } from "@/lib/semantics/token-expiry";

export const SETTINGS_DEFAULT_HREF = "/settings/project";
export const SETTINGS_INTEGRATIONS_HREF = "/settings/integrations";

/**
 * #346 flows-9: where the sidebar "Cài đặt" item points. Admins land on Kết nối while Threads is not connected or
 * its token expires within FR-046's window; everyone else (and admins before the status loads) gets the project tab.
 */
export function settingsHref(
  role: UserRole | null,
  integration: { status: IntegrationStatus; tokenExpiresAt: string | null } | undefined,
  nowMs: number,
): string {
  if (role !== "admin" || !integration) return SETTINGS_DEFAULT_HREF;
  if (integration.status !== "connected") return SETTINGS_INTEGRATIONS_HREF;
  const expiry = tokenExpiryState(integration.status, integration.tokenExpiresAt, nowMs);
  return expiry === "soon" || expiry === "expired" ? SETTINGS_INTEGRATIONS_HREF : SETTINGS_DEFAULT_HREF;
}

/**
 * Threads status for the sidebar — same cache key as Settings → Kết nối. Admin-only (the API returns 403 to other
 * roles, FR-015), so non-admins never fire the request.
 */
export function useSidebarIntegration(pid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.integration(pid ?? ""),
    queryFn: async () =>
      ThreadsIntegrationStatusSchema.parse(await apiFetch<unknown>(`/projects/${pid}/integrations/threads`)),
    enabled: enabled && !!pid,
  });
}
