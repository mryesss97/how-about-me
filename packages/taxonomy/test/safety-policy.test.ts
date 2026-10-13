import { describe, expect, it } from "vitest";
import { mapSafetyLevel, SAFETY_CATEGORIES, SAFETY_POLICY_V1, SAFETY_POLICY_VERSION } from "../src/index.js";

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

// TC-ANA-007 (FR-105, BR-018): boundary tests across the whole §9 table.
describe("TC-ANA-007 safety-policy-v1 full-table boundaries", () => {
  const eps = 1e-4;
  const level = (category: string, score: number, flagged = false) =>
    mapSafetyLevel({ categoryScores: { [category]: score }, flagged }).level;
  const rows = SAFETY_CATEGORIES.map((c) => [c, SAFETY_POLICY_V1[c]] as const);

  it("table matches doc 08 §9 exactly (changes must bump version)", () => {
    expect(SAFETY_POLICY_V1).toEqual({
      harassment: { sensitive: 0.5, severe: null },
      "harassment/threatening": { sensitive: 0.3, severe: 0.7 },
      hate: { sensitive: 0.4, severe: 0.8 },
      "hate/threatening": { sensitive: 0.3, severe: 0.6 },
      sexual: { sensitive: 0.5, severe: null },
      "sexual/minors": { sensitive: null, severe: 0.3 },
      violence: { sensitive: 0.5, severe: 0.85 },
      "violence/graphic": { sensitive: 0.4, severe: 0.8 },
      "self-harm": { sensitive: 0.3, severe: 0.7 },
      "self-harm/intent": { sensitive: null, severe: 0.4 },
      "self-harm/instructions": { sensitive: null, severe: 0.4 },
      illicit: { sensitive: 0.5, severe: null },
      "illicit/violent": { sensitive: 0.4, severe: 0.7 },
    });
    expect(Object.keys(SAFETY_POLICY_V1)).toEqual([...SAFETY_CATEGORIES]);
    expect(Object.isFrozen(SAFETY_POLICY_V1)).toBe(true);
  });

  it.each(rows)("%s: thresholds are inclusive", (category, t) => {
    expect(level(category, 0)).toBe("safe");
    if (t.sensitive != null) {
      expect(level(category, t.sensitive - eps)).toBe("safe");
      expect(level(category, t.sensitive)).toBe("sensitive");
    }
    if (t.severe != null) {
      expect(level(category, t.severe - eps)).toBe(t.sensitive != null ? "sensitive" : "safe");
      expect(level(category, t.severe)).toBe("severe");
      expect(level(category, 1)).toBe("severe");
    } else {
      expect(level(category, 1)).toBe("sensitive");
    }
  });

  it.each(rows)("%s: flagged with low score → sensitive", (category) => {
    expect(level(category, 0, true)).toBe("sensitive");
  });

  it("severe takes precedence over sensitive and flagged; triggered lists each crossing", () => {
    const r = mapSafetyLevel({
      categoryScores: { violence: 0.85, harassment: 0.5, hate: 0.1 },
      flagged: true,
    });
    expect(r.level).toBe("severe");
    expect(r.triggered).toEqual([
      { category: "violence", score: 0.85, level: "severe" },
      { category: "harassment", score: 0.5, level: "sensitive" },
    ]);
  });

  it("BR-017: input has no sentiment field — only categoryScores and flagged", () => {
    const input: Parameters<typeof mapSafetyLevel>[0] = { categoryScores: {}, flagged: false };
    expect(Object.keys(input).sort()).toEqual(["categoryScores", "flagged"]);
  });
});

// BR-018: a custom per-project policy (FR-190) is applied with its own version string.
describe("mapSafetyLevel with a custom policy (BR-018)", () => {
  it("uses the given thresholds and version", () => {
    const policy = { ...SAFETY_POLICY_V1, hate: { sensitive: 0.4, severe: 0.7 } };
    const r = mapSafetyLevel({ categoryScores: { hate: 0.75 }, flagged: false }, policy, "safety-policy-v2");
    expect(r.level).toBe("severe");
    expect(r.policyVersion).toBe("safety-policy-v2");
    expect(mapSafetyLevel({ categoryScores: { hate: 0.75 }, flagged: false }).level).toBe("sensitive");
  });
});
