import { describe, expect, it } from "vitest";
import { mapSafetyLevel, SAFETY_POLICY_VERSION } from "../src/index.js";

describe("mapSafetyLevel (safety-policy-v1)", () => {
  it("returns safe when nothing crosses and not flagged", () => {
    const r = mapSafetyLevel({ categoryScores: { harassment: 0.1, violence: 0.2 }, flagged: false });
    expect(r.level).toBe("safe");
    expect(r.policyVersion).toBe(SAFETY_POLICY_VERSION);
    expect(r.triggered).toEqual([]);
  });
  it("returns sensitive at the sensitive boundary (inclusive)", () => {
    expect(mapSafetyLevel({ categoryScores: { harassment: 0.5 }, flagged: false }).level).toBe("sensitive");
    expect(mapSafetyLevel({ categoryScores: { harassment: 0.4999 }, flagged: false }).level).toBe("safe");
  });
  it("returns severe at the severe boundary and takes precedence", () => {
    const r = mapSafetyLevel({ categoryScores: { "hate/threatening": 0.6, harassment: 0.9 }, flagged: true });
    expect(r.level).toBe("severe");
    expect(r.triggered.map((t) => t.level).sort()).toEqual(["sensitive", "severe"]);
  });
  it("uses provider flagged as sensitive fallback", () => {
    expect(mapSafetyLevel({ categoryScores: {}, flagged: true }).level).toBe("sensitive");
  });
  it("ignores unknown categories and NaN", () => {
    expect(mapSafetyLevel({ categoryScores: { unknown: 1, violence: Number.NaN }, flagged: false }).level).toBe("safe");
  });
  it("sexual/minors has no sensitive band — jumps straight to severe", () => {
    expect(mapSafetyLevel({ categoryScores: { "sexual/minors": 0.29 }, flagged: false }).level).toBe("safe");
    expect(mapSafetyLevel({ categoryScores: { "sexual/minors": 0.3 }, flagged: false }).level).toBe("severe");
  });
});
