import { describe, expect, it } from "vitest";
import {
  calendarRangeToInstants,
  expectedInterval,
  instantsToCalendarRange,
  resolveRange,
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
