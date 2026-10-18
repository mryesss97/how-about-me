import type { OverviewResponse } from "@how-about-me/contracts";
import { describe, expect, it } from "vitest";
import { syncFreshness } from "./sync-freshness";

type DQ = OverviewResponse["dataQuality"];
const base: DQ = {
  lastSyncStatus: "success",
  lastSyncAt: "2026-10-19T02:55:00Z",
  integrationStatus: "connected",
  collectorStatus: "healthy",
};
const now = new Date("2026-10-19T03:00:00Z");
const f = (p: Partial<DQ>) => syncFreshness({ ...base, ...p }, now, "Asia/Ho_Chi_Minh");

// #345 (flows-4), BR-032: a time is a figure only for a successful last sync.
describe("syncFreshness (#345)", () => {
  it("success → time as a figure", () => {
    expect(f({})).toEqual({ text: "5 phút trước", status: false, alert: false });
  });
  it.each(["failed", "partial"] as const)("%s → never a fresh-looking time", (s) => {
    expect(f({ lastSyncStatus: s })).toEqual({ text: "Đồng bộ lỗi · 5 phút trước", status: true, alert: true });
  });
  it("disconnected / broken integration / collector paused", () => {
    expect(f({ integrationStatus: "disconnected" }).text).toBe("Chưa kết nối Threads");
    expect(f({ integrationStatus: "expired" }).text).toBe("Kết nối Threads tạm dừng");
    expect(f({ integrationStatus: "permission_error" }).text).toBe("Kết nối Threads tạm dừng");
    expect(f({ collectorStatus: "paused" })).toEqual({ text: "Thu thập tạm dừng", status: true, alert: true });
  });
  it("no sync in window → status, not alert", () => {
    expect(f({ lastSyncStatus: "none", lastSyncAt: null })).toEqual({
      text: "Chưa có lượt đồng bộ gần đây",
      status: true,
      alert: false,
    });
  });
});
