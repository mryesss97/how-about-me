import { SAFETY_POLICY_V1 } from "@how-about-me/taxonomy";
import { describe, expect, it } from "vitest";
import {
  ConfidenceBandsSchema,
  SafetyThresholdSchema,
  SafetyThresholdsSchema,
  UpdateAnalysisSettingsBodySchema,
} from "../src/index.js";

// FR-190: analysis settings validation (BR-018 thresholds, BR-021 bands).
describe("analysis settings contracts (FR-190)", () => {
  it("BR-021: bands require medium < high and values in [0.01, 1] step 0.01", () => {
    expect(ConfidenceBandsSchema.safeParse({ high: 0.8, medium: 0.6 }).success).toBe(true);
    expect(ConfidenceBandsSchema.safeParse({ high: 0.6, medium: 0.6 }).success).toBe(false);
    expect(ConfidenceBandsSchema.safeParse({ high: 0.6, medium: 0.7 }).success).toBe(false);
    expect(ConfidenceBandsSchema.safeParse({ high: 1.1, medium: 0.6 }).success).toBe(false);
    expect(ConfidenceBandsSchema.safeParse({ high: 0.8, medium: 0 }).success).toBe(false);
    expect(ConfidenceBandsSchema.safeParse({ high: 0.8, medium: 0.605 }).success).toBe(false);
  });

  it("BR-018: threshold needs one level and sensitive < severe", () => {
    expect(SafetyThresholdSchema.safeParse({ sensitive: 0.4, severe: 0.85 }).success).toBe(true);
    expect(SafetyThresholdSchema.safeParse({ sensitive: null, severe: 0.3 }).success).toBe(true);
    expect(SafetyThresholdSchema.safeParse({ sensitive: null, severe: null }).success).toBe(false);
    expect(SafetyThresholdSchema.safeParse({ sensitive: 0.8, severe: 0.8 }).success).toBe(false);
  });

  it("BR-018: v1 table parses; missing or unknown categories are rejected", () => {
    expect(SafetyThresholdsSchema.safeParse(SAFETY_POLICY_V1).success).toBe(true);
    const { hate: _h, ...missing } = SAFETY_POLICY_V1;
    expect(SafetyThresholdsSchema.safeParse(missing).success).toBe(false);
    expect(
      SafetyThresholdsSchema.safeParse({ ...SAFETY_POLICY_V1, spam: { sensitive: 0.5, severe: null } }).success,
    ).toBe(false);
  });

  it("PATCH body: partial per category, non-empty, no unknown category", () => {
    expect(
      UpdateAnalysisSettingsBodySchema.safeParse({ safetyThresholds: { hate: { sensitive: 0.4, severe: 0.7 } } })
        .success,
    ).toBe(true);
    expect(UpdateAnalysisSettingsBodySchema.safeParse({ confidenceBands: { high: 0.9, medium: 0.5 } }).success).toBe(
      true,
    );
    expect(UpdateAnalysisSettingsBodySchema.safeParse({}).success).toBe(false);
    expect(UpdateAnalysisSettingsBodySchema.safeParse({ safetyThresholds: {} }).success).toBe(false);
    expect(
      UpdateAnalysisSettingsBodySchema.safeParse({ safetyThresholds: { spam: { sensitive: 0.5, severe: null } } })
        .success,
    ).toBe(false);
  });
});
