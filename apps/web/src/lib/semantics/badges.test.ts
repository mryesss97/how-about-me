import { describe, expect, it } from "vitest";
import { analysisStatusBadge, formatGrowth, formatRate, safetyBadge, sentimentBadge } from "./badges";

describe("semantic badges", () => {
  it("every badge has a text label and an icon (never colour alone)", () => {
    for (const spec of [
      ...Object.values(sentimentBadge),
      ...Object.values(safetyBadge),
      ...Object.values(analysisStatusBadge),
    ]) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.icon.length).toBeGreaterThan(0);
    }
  });
  it("formats rates and growth per metric rules", () => {
    expect(formatRate(0.6204)).toBe("62.0%");
    expect(formatRate(null)).toBe("—");
    expect(formatGrowth(21.4, "up")).toBe("+21.4%");
    expect(formatGrowth(-3, "down")).toBe("-3.0%");
    expect(formatGrowth(null, "new")).toBe("New");
  });
});
