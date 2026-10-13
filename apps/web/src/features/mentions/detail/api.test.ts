import { describe, expect, it } from "vitest";
import { canReanalyze } from "./api";

// FR-155 / BR-033: FE gating mirrors the server rule.
describe("canReanalyze (BR-033)", () => {
  it("admin always", () => {
    expect(canReanalyze("admin", { allowAnalystReanalyze: false })).toBe(true);
    expect(canReanalyze("admin", null)).toBe(true);
  });
  it("analyst only when the project setting allows it", () => {
    expect(canReanalyze("analyst", { allowAnalystReanalyze: true })).toBe(true);
    expect(canReanalyze("analyst", { allowAnalystReanalyze: false })).toBe(false);
    expect(canReanalyze("analyst", null)).toBe(false);
  });
  it("viewer and no role never", () => {
    expect(canReanalyze("viewer", { allowAnalystReanalyze: true })).toBe(false);
    expect(canReanalyze(null, { allowAnalystReanalyze: true })).toBe(false);
  });
});
