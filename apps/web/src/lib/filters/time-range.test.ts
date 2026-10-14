import { describe, expect, it } from "vitest";
import {
  calendarRangeToInstants,
  expectedInterval,
  instantsToCalendarRange,
  resolveRange,
  timezoneChangePatch,
  validateRange,
} from "./time-range";

const now = new Date("2026-10-13T05:30:00.000Z");
const H = 3_600_000;

describe("resolveRange — TC-DASH-002 (FR-131)", () => {
  it.each([
    ["1h", 1 * H, "hour"],
    ["24h", 24 * H, "hour"],
    ["7d", 7 * 24 * H, "day"],
    ["30d", 30 * 24 * H, "day"],
  ] as const)("preset %s spans the right duration and interval", (preset, ms, interval) => {
    const r = resolveRange({ preset, from: null, to: null }, now);
    expect(r.to).toBe(now.toISOString());
    expect(new Date(r.to).getTime() - new Date(r.from).getTime()).toBe(ms);
    expect(expectedInterval(new Date(r.from), new Date(r.to))).toBe(interval);
  });

  it("48h exactly is still hour", () => {
    expect(expectedInterval(new Date(0), new Date(48 * H))).toBe("hour");
    expect(expectedInterval(new Date(0), new Date(48 * H + 1))).toBe("day");
  });

  it("custom uses stored instants and falls back to 7d when incomplete", () => {
    const from = new Date("2026-10-01T00:00:00Z");
    const to = new Date("2026-10-05T00:00:00Z");
    expect(resolveRange({ preset: "custom", from, to }, now)).toEqual({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const fb = resolveRange({ preset: "custom", from, to: null }, now);
    expect(new Date(fb.to).getTime() - new Date(fb.from).getTime()).toBe(7 * 24 * H);
  });
});

describe("calendarRangeToInstants — TC-DASH-004", () => {
  it("converts calendar days in the selected tz, Asia/Ho_Chi_Minh is 7h before UTC", () => {
    const vn = calendarRangeToInstants("2026-10-01", "2026-10-07", "Asia/Ho_Chi_Minh");
    const utc = calendarRangeToInstants("2026-10-01", "2026-10-07", "UTC");
    expect(vn.from.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(vn.to.toISOString()).toBe("2026-10-07T17:00:00.000Z");
    expect(utc.from.getTime() - vn.from.getTime()).toBe(7 * H);
  });

  it("round-trips back to the same calendar days", () => {
    const { from, to } = calendarRangeToInstants("2026-10-01", "2026-10-07", "Asia/Ho_Chi_Minh");
    const r = instantsToCalendarRange(from, to, "Asia/Ho_Chi_Minh");
    expect(r.start.toString()).toBe("2026-10-01");
    expect(r.end.toString()).toBe("2026-10-07");
  });
});

describe("validateRange — TC-DASH-003", () => {
  it("366 days OK, 367 days and to ≤ from rejected", () => {
    const from = new Date("2025-01-01T00:00:00Z");
    expect(validateRange(from, new Date(from.getTime() + 366 * 24 * H))).toBeNull();
    expect(validateRange(from, new Date(from.getTime() + 367 * 24 * H))).toMatch(/366/);
    expect(validateRange(from, from)).toMatch(/after/);
  });
});

describe("timezoneChangePatch — #240 (UX §2.1)", () => {
  const vn = {
    preset: "custom" as const,
    from: new Date("2026-09-30T17:00:00.000Z"),
    to: new Date("2026-10-07T17:00:00.000Z"),
    tz: "Asia/Ho_Chi_Minh",
  };

  /** Re-zoned custom range: fails the test when the patch has no `from`/`to`. */
  function rezone(filters: Parameters<typeof timezoneChangePatch>[0], nextTz: string) {
    const { from, to } = timezoneChangePatch(filters, nextTz);
    if (!from || !to) throw new Error("expected a re-zoned range");
    return { from, to };
  }

  it("keeps calendar dates 1–7 Oct when switching VN → Tokyo", () => {
    expect(timezoneChangePatch(vn, "Asia/Tokyo").tz).toBe("Asia/Tokyo");
    const p = rezone(vn, "Asia/Tokyo");
    expect(p.from.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-07T15:00:00.000Z");
    const r = instantsToCalendarRange(p.from, p.to, "Asia/Tokyo");
    expect([r.start.toString(), r.end.toString()]).toEqual(["2026-10-01", "2026-10-07"]);
  });

  it("re-zones VN → UTC and back", () => {
    const p = rezone(vn, "UTC");
    expect(p.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    const back = rezone({ preset: "custom", ...p, tz: "UTC" }, "Asia/Ho_Chi_Minh");
    expect(back.from).toEqual(vn.from);
    expect(back.to).toEqual(vn.to);
  });

  it("relative preset only changes tz", () => {
    expect(timezoneChangePatch({ preset: "7d", from: null, to: null, tz: "UTC" }, "Asia/Tokyo")).toEqual({
      tz: "Asia/Tokyo",
    });
  });

  it("same tz is a no-op", () => {
    expect(timezoneChangePatch(vn, "Asia/Ho_Chi_Minh")).toEqual({});
  });

  it("keeps instants of a non-midnight range (hour drill-down, FR-142)", () => {
    const hour = { ...vn, from: new Date("2026-10-01T03:00:00.000Z"), to: new Date("2026-10-01T04:00:00.000Z") };
    expect(timezoneChangePatch(hour, "UTC")).toEqual({ tz: "UTC" });
  });

  it("handles DST: New York range across 2026-11-01 keeps calendar dates", () => {
    const utc = { preset: "custom" as const, ...calendarRangeToInstants("2026-10-29", "2026-11-04", "UTC"), tz: "UTC" };
    const p = rezone(utc, "America/New_York");
    // 29 Oct 00:00 EDT (UTC-4) → 5 Nov 00:00 EST (UTC-5): one extra hour, same calendar days.
    expect(p.from.toISOString()).toBe("2026-10-29T04:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-11-05T05:00:00.000Z");
    const r = instantsToCalendarRange(p.from, p.to, "America/New_York");
    expect([r.start.toString(), r.end.toString()]).toEqual(["2026-10-29", "2026-11-04"]);
  });
});
