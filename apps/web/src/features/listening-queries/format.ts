import type { ListeningQuery, QueryType } from "@how-about-me/contracts";

export const queryTypeLabelVi: Record<QueryType, string> = { keyword: "Từ khoá", topic_tag: "Chủ đề" };

/** BR-004: tag values are stored without `#`; the UI shows it. */
export function formatQueryValue(q: Pick<ListeningQuery, "queryType" | "queryValue">): string {
  return q.queryType === "topic_tag" ? `#${q.queryValue}` : q.queryValue;
}

export type SyncTone = "success" | "error" | "warning" | "progress" | "neutral";
export type SyncStatus = { tone: SyncTone; label: string };

/**
 * Sync dot for "Lần đồng bộ cuối" (UX §3.5). Every status carries a text label — colour is never the only signal
 * (BR-017). Order: deleted → disabled → never run → last job status.
 */
export function syncStatus(q: Pick<ListeningQuery, "deletedAt" | "enabled" | "lastJob" | "lastError">): SyncStatus {
  if (q.deletedAt) return { tone: "neutral", label: "Đã xoá" };
  if (!q.enabled) return { tone: "neutral", label: "Tắt" };
  if (!q.lastJob) return q.lastError ? { tone: "error", label: "Lỗi" } : { tone: "neutral", label: "Chưa đồng bộ" };
  switch (q.lastJob.status) {
    case "success":
      return { tone: "success", label: "Thành công" };
    case "partial":
      return { tone: "warning", label: "Một phần" };
    case "failed":
      return { tone: "error", label: "Lỗi" };
    case "cancelled":
      return { tone: "neutral", label: "Đã huỷ" };
    case "running":
      return { tone: "progress", label: "Đang chạy" };
    case "queued":
      return { tone: "progress", label: "Đang chờ" };
  }
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
