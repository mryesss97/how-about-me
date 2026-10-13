import { DEFAULT_ANALYSIS_POLICY, SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import { diffPolicy, mergePolicy, toAnalysisPolicy } from "./analysis-policy";

/** FR-190: pure policy helpers (BR-018 thresholds, BR-021 bands). */
describe("analysis-policy (FR-190)", () => {
  it("BR-018 / BR-021: no row → v1 defaults", () => {
    expect(toAnalysisPolicy(null)).toBe(DEFAULT_ANALYSIS_POLICY);
    expect(toAnalysisPolicy(null).confidenceBands).toEqual({ high: 0.8, medium: 0.6 });
  });

  it("parses a stored row and rejects a corrupt one", () => {
    const row = {
      version: 2,
      policyVersion: "safety-policy-v2",
      confidenceBands: { high: 0.9, medium: 0.5 },
      safetyThresholds: SAFETY_POLICY_V1,
    };
    expect(toAnalysisPolicy(row)).toMatchObject({
      version: 2,
      policyVersion: "safety-policy-v2",
      confidenceBands: { high: 0.9, medium: 0.5 },
    });
    expect(() => toAnalysisPolicy({ ...row, safetyThresholds: { hate: { sensitive: 0.4, severe: 0.8 } } })).toThrow();
  });

  it("merges one category and keeps the rest; diff lists only changed leaves", () => {
    const merged = mergePolicy(DEFAULT_ANALYSIS_POLICY, {
      safetyThresholds: { hate: { sensitive: 0.4, severe: 0.7 } },
    });
    expect(merged.safetyThresholds.hate).toEqual({ sensitive: 0.4, severe: 0.7 });
    expect(merged.safetyThresholds.violence).toEqual(SAFETY_POLICY_V1.violence);
    expect(merged.confidenceBands).toEqual({ high: 0.8, medium: 0.6 });
    expect(diffPolicy(DEFAULT_ANALYSIS_POLICY, merged)).toEqual({
      "safetyThresholds.hate.severe": { from: 0.8, to: 0.7 },
    });
  });

  it("diffs bands and null transitions; no-op → empty", () => {
    const merged = mergePolicy(DEFAULT_ANALYSIS_POLICY, {
      confidenceBands: { high: 0.85, medium: 0.6 },
      safetyThresholds: { harassment: { sensitive: 0.5, severe: 0.9 } },
    });
    expect(diffPolicy(DEFAULT_ANALYSIS_POLICY, merged)).toEqual({
      "confidenceBands.high": { from: 0.8, to: 0.85 },
      "safetyThresholds.harassment.severe": { from: null, to: 0.9 },
    });
    const same = mergePolicy(DEFAULT_ANALYSIS_POLICY, { safetyThresholds: { hate: { sensitive: 0.4, severe: 0.8 } } });
    expect(diffPolicy(DEFAULT_ANALYSIS_POLICY, same)).toEqual({});
  });
});
