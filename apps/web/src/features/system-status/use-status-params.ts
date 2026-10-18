"use client";

import { AUDIT_ACTIONS, JOB_STATUSES, UuidSchema, type AuditAction, type JobStatus } from "@how-about-me/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type StatusTab = "overview" | "sync-jobs" | "analysis-failures" | "audit-log";
const TAB_IDS: readonly StatusTab[] = ["overview", "sync-jobs", "analysis-failures", "audit-log"];
export type SyncJobsParams = { queryId: string; status: JobStatus | ""; from: string; to: string };
export type AuditLogParams = { action: AuditAction | ""; actor: string; from: string; to: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * URL state for /system-status: `?tab=sync-jobs&queryId=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD&job=<id>`
 * so other screens can deep-link to a filtered list or an open job.
 * Audit log tab (admin, FR-201): `?tab=audit-log&action=<AuditAction>&actor=<userId>&from=&to=` (shares
 * `from`/`to`; #343 `actor` must be a UUID, else ignored).
 */
export function useStatusParams() {
  const router = useRouter();
  const pathname = usePathname() ?? "/system-status";
  const search = useSearchParams();
  const get = (k: string) => search?.get(k) ?? "";
  const rawStatus = get("status");
  const day = (k: string) => (DAY_RE.test(get(k)) ? get(k) : "");

  const rawTab = get("tab");
  const tab: StatusTab = (TAB_IDS as readonly string[]).includes(rawTab) ? (rawTab as StatusTab) : "overview";
  const filters: SyncJobsParams = {
    queryId: get("queryId"),
    status: (JOB_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as JobStatus) : "",
    from: day("from"),
    to: day("to"),
  };
  const rawAction = get("action");
  const auditFilters: AuditLogParams = {
    action: (AUDIT_ACTIONS as readonly string[]).includes(rawAction) ? (rawAction as AuditAction) : "",
    actor: UuidSchema.safeParse(get("actor")).success ? get("actor") : "",
    from: filters.from,
    to: filters.to,
  };
  const jobId = get("job") || null;

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(search?.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, search],
  );

  /** #348: href for a section tab; keeps the other params, drops the open job / audit action like `update` did. */
  const tabHref = (id: StatusTab) => {
    const next = new URLSearchParams(search?.toString());
    for (const k of ["tab", "job", "action"]) next.delete(k);
    if (id !== "overview") next.set("tab", id);
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };

  return { tab, filters, auditFilters, jobId, update, tabHref };
}
