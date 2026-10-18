import type { JobStatus, ListeningQuery } from "@how-about-me/contracts";
import { jobStatusLabelVi, queryTypeLabelVi } from "@/lib/semantics/labels";

export { queryTypeLabelVi };

/** BR-004: tag values are stored without `#`; the UI shows it. */
export function formatQueryValue(q: Pick<ListeningQuery, "queryType" | "queryValue">): string {
  return q.queryType === "topic_tag" ? `#${q.queryValue}` : q.queryValue;
}

export type SyncTone = "success" | "error" | "warning" | "progress" | "neutral";
export type SyncStatus = { tone: SyncTone; label: string };

const SYNC_TONE: Record<JobStatus, SyncTone> = {
  success: "success",
  partial: "warning",
  failed: "error",
  cancelled: "neutral",
  running: "progress",
  queued: "progress",
};

/**
 * Sync dot for "Lần đồng bộ cuối" (UX §3.5). Every status carries a text label — colour is never the only signal
 * (BR-017). Order: deleted → disabled → never run → last job status.
 */
export function syncStatus(q: Pick<ListeningQuery, "deletedAt" | "enabled" | "lastJob" | "lastError">): SyncStatus {
  if (q.deletedAt) return { tone: "neutral", label: "Đã xoá" };
  if (!q.enabled) return { tone: "neutral", label: "Tắt" };
  if (!q.lastJob)
    return q.lastError ? { tone: "error", label: jobStatusLabelVi.failed } : { tone: "neutral", label: "Chưa đồng bộ" };
  // #344: same word as System Status (shared map).
  return { tone: SYNC_TONE[q.lastJob.status], label: jobStatusLabelVi[q.lastJob.status] };
}

export { syncErrorLabel } from "@/lib/semantics/sync-errors";

export function truncateError(msg: string, max = 60): string {
  return msg.length <= max ? msg : `${msg.slice(0, max - 1).trimEnd()}…`;
}

/** Poll interval / overlap: "5 phút", "1 giờ 30 phút", "45 giây", "0 giây". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [h ? `${h} giờ` : "", m ? `${m} phút` : "", s ? `${s} giây` : ""].filter(Boolean);
  return parts.join(" ");
}

/** "Xem lượt đồng bộ" target (#43). #343: with `queryId` the list behind the drawer is already that query's job history. */
export const jobHref = (jobId: string, queryId?: string) =>
  `/system-status?tab=sync-jobs${queryId ? `&queryId=${queryId}` : ""}&job=${jobId}`;

/** The last error is history when a successful sync happened after it (#342 flows-5): shown grey, not red. */
export function isStaleError(q: Pick<ListeningQuery, "lastError" | "lastSuccessfulSyncAt">): boolean {
  return !!q.lastError && !!q.lastSuccessfulSyncAt && Date.parse(q.lastSuccessfulSyncAt) > Date.parse(q.lastError.at);
}

/**
 * Second line under the query name (#340 ops-1): "#eventista · Chủ đề". The value is dropped when it repeats the name
 * (case-insensitive, ignoring `#`).
 */
export function querySubline(q: Pick<ListeningQuery, "queryType" | "queryValue" | "displayName">): string {
  const norm = (s: string) => s.replace(/^#/, "").trim().toLowerCase();
  const type = queryTypeLabelVi[q.queryType];
  return norm(q.queryValue) === norm(q.displayName) ? type : `${formatQueryValue(q)} · ${type}`;
}

/** A queued/running last job keeps the list polling (#340 flows-6). */
export const isJobActive = (q: Pick<ListeningQuery, "lastJob" | "deletedAt">): boolean =>
  !q.deletedAt && (q.lastJob?.status === "queued" || q.lastJob?.status === "running");

export { mentionsHref, mentionsWindowHref } from "@/lib/links/mentions";
