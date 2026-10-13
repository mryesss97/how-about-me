import { describe, expect, it } from "vitest";
import { deltaDirection, formatCount, formatGrowth, formatRate, formatRateDelta } from "./number";

describe("KPI number formatting", () => {
  it("formatCount uses thousands separators", () => {
    expect(formatCount(2410)).toBe("2,410");
  });

  it("BR-032 / TC-DASH-008: null rate renders — not 0%", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(Number.NaN)).toBe("—");
    expect(formatRate(0)).toBe("0.0%");
    expect(formatRate(0.1234)).toBe("12.3%");
  });

  it("FR-133 / TC-DASH-007: growthState new renders New, never ∞/NaN", () => {
    expect(formatGrowth(null, "new")).toBe("New");
    expect(formatGrowth(Number.POSITIVE_INFINITY, "up")).toBe("—");
    expect(formatGrowth(0.125, "up")).toBe("+12.5%");
    expect(formatGrowth(-0.08, "down")).toBe("−8.0%");
    expect(formatGrowth(0.001, "flat")).toBe("0%");
  });

  it("flat threshold is |x| < 0.005 (doc 07 §1.2)", () => {
    expect(deltaDirection(0.004)).toBe("flat");
    expect(deltaDirection(0.006)).toBe("up");
    expect(deltaDirection(-0.006)).toBe("down");
  });

  it("rate delta is in percentage points and null without previous", () => {
    expect(formatRateDelta(0.3, 0.279)).toEqual({ text: "+2.1 pp", direction: "up" });
    expect(formatRateDelta(0.3, null)).toBeNull();
    expect(formatRateDelta(null, 0.2)).toBeNull();
  });
});
