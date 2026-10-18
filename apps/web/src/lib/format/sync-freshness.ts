import type { OverviewResponse } from "@how-about-me/contracts";
import { NO_RECENT_SYNC, viUpdated } from "./relative-time";

export type SyncFreshness = {
  text: string;
  /** A state, not a time figure → set as small print. */
  status: boolean;
  /** Collection is broken / paused / the last sync failed (icon next to the text). */
  alert: boolean;
};

/**
 * #345 (flows-4): the "cập nhật" figure only shows a time as a figure when the last sync *succeeded*; a failed or
 * paused collection says so in Vietnamese instead of a fresh-looking time (BR-032: states stay distinct).
 */
export function syncFreshness(dq: OverviewResponse["dataQuality"], now: Date, timeZone: string): SyncFreshness {
  if (dq.integrationStatus === "disconnected") return { text: "Chưa kết nối Threads", status: true, alert: true };
  if (dq.integrationStatus !== "connected") return { text: "Kết nối Threads tạm dừng", status: true, alert: true };
  if (dq.collectorStatus === "paused") return { text: "Thu thập tạm dừng", status: true, alert: true };
  if ((dq.lastSyncStatus === "failed" || dq.lastSyncStatus === "partial") && dq.lastSyncAt)
    return { text: `Đồng bộ lỗi · ${viUpdated(dq.lastSyncAt, now, timeZone)}`, status: true, alert: true };
  if (dq.lastSyncStatus === "success" && dq.lastSyncAt)
    return { text: viUpdated(dq.lastSyncAt, now, timeZone), status: false, alert: false };
  return { text: NO_RECENT_SYNC, status: true, alert: false };
}
