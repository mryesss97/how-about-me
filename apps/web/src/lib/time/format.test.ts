import { describe, expect, it } from "vitest";
import { formatDateTime, formatShortDateTime, formatRelativeOrAbsolute, tzLabel } from "./format";

describe("tzLabel", () => {
  const at = new Date("2026-01-15T00:00:00Z");

  it("formats whole-hour, zero, negative and half-hour offsets the same on server and client", () => {
    expect(tzLabel("Asia/Ho_Chi_Minh", at)).toBe("GMT+7 · Asia/Ho_Chi_Minh");
    expect(tzLabel("UTC", at)).toBe("GMT+0 · UTC");
    expect(tzLabel("America/New_York", at)).toBe("GMT-5 · America/New_York");
    expect(tzLabel("Asia/Kolkata", at)).toBe("GMT+5:30 · Asia/Kolkata");
  });
});

describe("formatRelativeOrAbsolute (#277: Vietnamese)", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  it("uses Vietnamese relative text under 24h and vi-VN absolute after", () => {
    expect(formatRelativeOrAbsolute(new Date("2026-01-15T11:59:45Z"), now)).toBe("vừa xong");
    expect(formatRelativeOrAbsolute(new Date("2026-01-15T11:55:00Z"), now)).toBe("5 phút trước");
    expect(formatRelativeOrAbsolute(new Date("2026-01-15T09:00:00Z"), now)).toBe("3 giờ trước");
    expect(formatRelativeOrAbsolute(new Date("2026-01-10T03:30:00Z"), now, "Asia/Ho_Chi_Minh")).toBe(
      formatDateTime(new Date("2026-01-10T03:30:00Z"), "Asia/Ho_Chi_Minh"),
    );
    expect(formatDateTime(new Date("2026-01-10T03:30:00Z"), "Asia/Ho_Chi_Minh")).toContain("2026");
  });
});

describe("formatShortDateTime (#344)", () => {
  it("formats HH:mm dd/MM in the given timezone", () => {
    expect(formatShortDateTime("2026-10-17T16:46:00Z", "Asia/Ho_Chi_Minh")).toBe("23:46 17/10");
  });
  it("uses h23 at midnight (no 24:xx)", () => {
    expect(formatShortDateTime("2026-10-17T17:05:00Z", "Asia/Ho_Chi_Minh")).toBe("00:05 18/10");
  });
});
