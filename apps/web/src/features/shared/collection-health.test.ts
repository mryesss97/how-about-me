import { describe, expect, it } from "vitest";
import { collectionNotice, FAILED_JOBS_HREF, navHealth } from "./collection-health";
import { healthFixture } from "./health-fixture.test-utils";

const now = Date.parse("2026-10-19T03:00:00.000Z");
const admin = { isAdmin: true, nowMs: now, timeZone: "Asia/Ho_Chi_Minh" };
const viewer = { isAdmin: false, nowMs: now, timeZone: "Asia/Ho_Chi_Minh" };

// #345 (flows-4), BR-033 / FR-015: one strip, link for admins only.
describe("collectionNotice (#345)", () => {
  it("healthy → null", () => {
    expect(collectionNotice(healthFixture(), admin)).toBeNull();
  });

  it.each(["expired", "permission_error", "error"] as const)("Threads %s → error; admin gets Mở Kết nối", (status) => {
    const d = healthFixture({ threads: { status } });
    expect(collectionNotice(d, admin)).toMatchObject({
      kind: "threads",
      tone: "error",
      title: "Kết nối Threads cần được xử lý.",
      action: { href: "/settings/integrations", label: "Mở Kết nối" },
    });
    const v = collectionNotice(d, viewer);
    expect(v?.action).toBeNull();
    expect(v?.description).toContain("Hãy liên hệ quản trị dự án.");
  });

  it("disconnected → Chưa kết nối Threads.", () => {
    expect(collectionNotice(healthFixture({ threads: { status: "disconnected" } }), viewer)).toMatchObject({
      kind: "not-connected",
      title: "Chưa kết nối Threads.",
      action: null,
    });
  });

  it("collector paused / circuit open → Bộ thu thập đang tạm dừng; admin links failed jobs", () => {
    const d = healthFixture({ collector: { circuit: { open: true, until: null, reason: "rate" } } });
    expect(collectionNotice(d, admin)).toMatchObject({
      kind: "collector-paused",
      title: "Bộ thu thập đang tạm dừng.",
      action: { href: FAILED_JOBS_HREF, label: "Xem lượt lỗi" },
    });
    expect(collectionNotice(healthFixture({ collector: { status: "paused" } }), viewer)?.action).toBeNull();
  });

  // FR-046: ≤ 7 days, admin only; date in the project timezone (22/10 18:00Z = 23/10 01:00 ICT).
  it("token expiring in 4 days → admin warning with dd/MM in project tz; others null", () => {
    const d = healthFixture({ threads: { tokenExpiresAt: "2026-10-22T18:00:00.000Z" } });
    const n = collectionNotice(d, admin);
    expect(n).toMatchObject({ kind: "token-soon", tone: "warning", action: { href: "/settings/integrations" } });
    expect(n?.title).toBe("Token Threads hết hạn ngày 23/10 (còn 4 ngày).");
    expect(collectionNotice(d, viewer)).toBeNull();
  });

  it("token 8 days out → null; already past → error for every role", () => {
    expect(
      collectionNotice(healthFixture({ threads: { tokenExpiresAt: "2026-10-27T03:00:00.000Z" } }), admin),
    ).toBeNull();
    const past = healthFixture({ threads: { tokenExpiresAt: "2026-10-18T00:00:00.000Z" } });
    expect(collectionNotice(past, viewer)?.kind).toBe("threads");
  });

  it("priority: Threads broken wins over paused + token soon", () => {
    const d = healthFixture({
      threads: { status: "expired", tokenExpiresAt: "2026-10-22T00:00:00.000Z" },
      collector: { status: "paused" },
    });
    expect(collectionNotice(d, admin)?.kind).toBe("threads");
  });

  it("uses the given nowMs (server generatedAt), not the machine clock", () => {
    const d = healthFixture({ threads: { tokenExpiresAt: "2026-10-22T18:00:00.000Z" } });
    expect(collectionNotice(d, { ...admin, nowMs: Date.parse("2026-10-01T00:00:00Z") })).toBeNull();
  });
});

// #345, BR-017: dot always with a word.
describe("navHealth (#345)", () => {
  it("healthy → null; degraded → Chậm; broken → Lỗi; token soon → Sắp hết hạn (admin)", () => {
    expect(navHealth(healthFixture(), admin)).toBeNull();
    expect(navHealth(healthFixture({ collector: { status: "degraded" } }), viewer)).toEqual({
      level: "warning",
      word: "Chậm",
    });
    expect(navHealth(healthFixture({ analysis: { status: "budget_paused" } }), viewer)?.word).toBe("Chậm");
    expect(navHealth(healthFixture({ threads: { status: "expired" } }), viewer)).toEqual({
      level: "error",
      word: "Lỗi",
    });
    const soon = healthFixture({ threads: { tokenExpiresAt: "2026-10-22T18:00:00.000Z" } });
    expect(navHealth(soon, admin)).toEqual({ level: "warning", word: "Sắp hết hạn" });
    expect(navHealth(soon, viewer)).toBeNull();
  });
});
