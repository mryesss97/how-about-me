"use client";

import { JOB_STATUSES, type JobStatus } from "@how-about-me/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type StatusTab = "overview" | "sync-jobs";
export type SyncJobsParams = { queryId: string; status: JobStatus | ""; from: string; to: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * URL state for /system-status: `?tab=sync-jobs&queryId=&status=&from=YYYY-MM-DD&to=YYYY-MM-DD&job=<id>`
 * so other screens can deep-link to a filtered list or an open job.
 */
export function useStatusParams() {
  const router = useRouter();
  const pathname = usePathname() ?? "/system-status";
  const search = useSearchParams();
  const get = (k: string) => search?.get(k) ?? "";
  const rawStatus = get("status");
  const day = (k: string) => (DAY_RE.test(get(k)) ? get(k) : "");

  const tab: StatusTab = get("tab") === "sync-jobs" ? "sync-jobs" : "overview";
  const filters: SyncJobsParams = {
    queryId: get("queryId"),
    status: (JOB_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as JobStatus) : "",
    from: day("from"),
    to: day("to"),
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

  return { tab, filters, jobId, update };
}
