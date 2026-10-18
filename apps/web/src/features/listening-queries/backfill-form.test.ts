import { describe, expect, it } from "vitest";
import { defaultRange, isTerminal, progressSummary, toBackfillBody, validateBackfillRange } from "./backfill-form";

const NOW = new Date("2026-10-18T05:00:00.000Z"); // 12:00 in Asia/Ho_Chi_Minh

describe("backfill-form (FR-063)", () => {
  it("converts VN calendar days to UTC ISO", () => {
    const body = toBackfillBody({ start: "2026-10-01", end: "2026-10-02" }, "TOP", "Asia/Ho_Chi_Minh", NOW);
    expect(body).toEqual({ since: "2026-09-30T17:00:00.000Z", until: "2026-10-02T17:00:00.000Z", searchType: "TOP" });
  });

  it("clamps until to now when the range ends today", () => {
    const body = toBackfillBody({ start: "2026-10-17", end: "2026-10-18" }, "RECENT", "Asia/Ho_Chi_Minh", NOW);
    expect(body.until).toBe(NOW.toISOString());
  });

  it("rejects reversed, future and > 30-day ranges; accepts exactly 30 days", () => {
    expect(validateBackfillRange({ start: "2026-10-10", end: "2026-10-09" }, NOW)).toMatch(/sau ngày bắt đầu/);
    expect(validateBackfillRange({ start: "2026-10-10", end: "2026-10-19" }, NOW)).toMatch(/tương lai/);
    expect(validateBackfillRange({ start: "2026-09-18", end: "2026-10-18" }, NOW)).toBe("Tối đa 30 ngày.");
    expect(validateBackfillRange({ start: "2026-09-19", end: "2026-10-18" }, NOW)).toBeNull();
  });

  it("default range is the last 7 days in tz", () => {
    expect(defaultRange("Asia/Ho_Chi_Minh", NOW)).toEqual({ start: "2026-10-12", end: "2026-10-18" });
    expect(validateBackfillRange(defaultRange("Asia/Ho_Chi_Minh", NOW), NOW)).toBeNull();
  });

  it("isTerminal / progressSummary", () => {
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("queued")).toBe(false);
    expect(isTerminal("partial")).toBe(true);
    expect(
      progressSummary({ pagesFetched: 2, recordsFetched: 40, recordsInserted: 30, recordsDuplicated: 10 }).map(
        (s) => s.value,
      ),
    ).toEqual([2, 40, 30, 10]);
  });
});
