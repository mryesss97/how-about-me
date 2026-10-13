import { describe, expect, it } from "vitest";
import { tzLabel } from "./format";

describe("tzLabel", () => {
  const at = new Date("2026-01-15T00:00:00Z");

  it("formats whole-hour, zero, negative and half-hour offsets the same on server and client", () => {
    expect(tzLabel("Asia/Ho_Chi_Minh", at)).toBe("GMT+7 · Asia/Ho_Chi_Minh");
    expect(tzLabel("UTC", at)).toBe("GMT+0 · UTC");
    expect(tzLabel("America/New_York", at)).toBe("GMT-5 · America/New_York");
    expect(tzLabel("Asia/Kolkata", at)).toBe("GMT+5:30 · Asia/Kolkata");
  });
});
