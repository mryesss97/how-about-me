import { describe, expect, it } from "vitest";
import * as taxonomy from "../src/index.js";

// BR-023: version strings persisted on every analysis run.
describe("versions (BR-023)", () => {
  it("exports v1 version strings from index", () => {
    expect(taxonomy.TAXONOMY_VERSION).toBe("taxonomy-v1");
    expect(taxonomy.SAFETY_POLICY_VERSION).toBe("safety-policy-v1");
    expect(taxonomy.DEFAULT_PROMPT_VERSION).toBe("classifier-v1");
    expect(taxonomy.METRICS_VERSION).toBe("metrics-v1");
  });
});

// FR-190 / BR-018: per-project policy versions `safety-policy-v{n}`.
describe("safety policy version helpers (FR-190, BR-018)", () => {
  it("formats and parses safety-policy-v{n}", () => {
    expect(taxonomy.safetyPolicyVersionOf(2)).toBe("safety-policy-v2");
    expect(taxonomy.parseSafetyPolicyVersion("safety-policy-v12")).toBe(12);
    expect(taxonomy.parseSafetyPolicyVersion(taxonomy.SAFETY_POLICY_VERSION)).toBe(1);
    expect(taxonomy.parseSafetyPolicyVersion("safety-policy-v0")).toBeNull();
    expect(taxonomy.parseSafetyPolicyVersion("taxonomy-v1")).toBeNull();
  });

  it("DEFAULT_ANALYSIS_POLICY is v1 bands + thresholds (BR-021, BR-018)", () => {
    expect(taxonomy.DEFAULT_ANALYSIS_POLICY).toEqual({
      version: 1,
      policyVersion: "safety-policy-v1",
      confidenceBands: { high: 0.8, medium: 0.6 },
      safetyThresholds: taxonomy.SAFETY_POLICY_V1,
    });
  });
});
