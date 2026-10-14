import { describe, expect, it } from "vitest";
import { deltaDirection, formatCount, formatGrowth, formatRate, formatRateDelta } from "./number";

describe("KPI number formatting", () => {
  it("formatCount uses vi-VN thousands separators", () => {
    expect(formatCount(2410)).toBe("2.410");
    expect(formatCount(1234567)).toBe("1.234.567");
  });

  it("BR-032 / TC-DASH-008: null rate renders — not 0%", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(Number.NaN)).toBe("—");
    expect(formatRate(0)).toBe("0,0%");
    expect(formatRate(0.1234)).toBe("12,3%");
  });

  it("FR-133 / TC-DASH-007: growthState new renders Mới, never ∞/NaN", () => {
    expect(formatGrowth(null, "new")).toBe("Mới");
    expect(formatGrowth(Number.POSITIVE_INFINITY, "up")).toBe("—");
    expect(formatGrowth(0.1, "flat")).toBe("0%");
  });

  it("#211 / FR-133: growthPct is already a percent (API contract 05), not multiplied again", () => {
    expect(formatGrowth(162.5, "up")).toBe("+162,5%");
    expect(formatGrowth(12.5, "up")).toBe("+12,5%");
    expect(formatGrowth(21.4, "up")).toBe("+21,4%");
    expect(formatGrowth(-8, "down")).toBe("−8,0%");
    expect(formatGrowth(-61.9, "down")).toBe("−61,9%");
    expect(formatGrowth(null, "up")).toBe("—");
  });

  it("flat threshold is |x| < 0.005 (doc 07 §1.2)", () => {
    expect(deltaDirection(0.004)).toBe("flat");
    expect(deltaDirection(0.006)).toBe("up");
    expect(deltaDirection(-0.006)).toBe("down");
  });

  it("rate delta is in percentage points and null without previous", () => {
    expect(formatRateDelta(0.3, 0.279)).toEqual({ text: "+2,1 điểm %", direction: "up" });
    // #211 regression: rates are 0..1 ratios, ×100 exactly once.
    expect(formatRateDelta(0.25, 0.2)).toEqual({ text: "+5,0 điểm %", direction: "up" });
    expect(formatRateDelta(0.3, null)).toBeNull();
    expect(formatRateDelta(null, 0.2)).toBeNull();
  });
});
