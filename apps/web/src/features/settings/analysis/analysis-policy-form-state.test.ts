import { describe, expect, it } from "vitest";
import { analysisSettingsData } from "../test-fixtures";
import {
  diffAnalysisSettings,
  errorsFromIssues,
  parseProbability,
  toDraft,
  validateDraft,
} from "./analysis-policy-form-state";

const base = analysisSettingsData();

// FR-190
describe("analysis policy form state", () => {
  it("unchanged draft → empty diff", () => {
    expect(diffAnalysisSettings(base, toDraft(base))).toEqual({});
  });

  it("only the changed category goes into the body", () => {
    const d = toDraft(base);
    d.thresholds.hate.sensitive = "0.4";
    expect(diffAnalysisSettings(base, d)).toEqual({ safetyThresholds: { hate: { sensitive: 0.4, severe: 0.8 } } });
  });

  it("changing one band sends the full pair", () => {
    const d = toDraft(base);
    d.bands.medium = "0.6";
    expect(diffAnalysisSettings(base, d)).toEqual({ confidenceBands: { high: 0.8, medium: 0.6 } });
  });

  it("an empty cell means null", () => {
    const d = toDraft(base);
    d.thresholds.sexual.sensitive = "";
    expect(parseProbability("  ")).toBeNull();
    expect(diffAnalysisSettings(base, d)).toEqual({ safetyThresholds: { sexual: { sensitive: null, severe: 0.8 } } });
    expect(validateDraft(d)).toEqual({});
  });

  it("BR-021: medium ≥ high is an error on confidenceBands.medium", () => {
    const d = toDraft(base);
    d.bands.medium = "0.8";
    expect(validateDraft(d)).toHaveProperty(["confidenceBands.medium"]);
  });

  it("BR-018: both empty is an error; sensitive ≥ severe is an error", () => {
    const d = toDraft(base);
    d.thresholds.hate = { sensitive: "", severe: "" };
    d.thresholds.violence = { sensitive: "0.9", severe: "0.8" };
    const errors = validateDraft(d);
    expect(errors).toHaveProperty(["safetyThresholds.hate"]);
    expect(errors).toHaveProperty(["safetyThresholds.violence.sensitive"]);
  });

  it.each(["0", "1.005", "abc", "-0.1", "2"])("rejects %s", (v) => {
    const d = toDraft(base);
    d.thresholds.illicit.severe = v;
    expect(validateDraft(d)).toHaveProperty(["safetyThresholds.illicit.severe"]);
  });

  it("rounds float noise (0.1 + 0.2) and accepts 0.07", () => {
    expect(parseProbability(String(0.1 + 0.2))).toBe(0.3);
    const d = toDraft(base);
    d.thresholds.illicit.sensitive = "0.07";
    expect(validateDraft(d)).toEqual({});
  });

  it("maps server issue paths for slash categories onto their cells; unknown paths go to form", () => {
    const issues = [
      { path: "safetyThresholds.hate/threatening.sensitive", message: "too high" },
      { path: "safetyThresholds.self-harm/intent", message: "pair" },
      { path: "somethingElse", message: "other" },
    ];
    expect(errorsFromIssues(issues, toDraft(base))).toEqual({
      "safetyThresholds.hate/threatening.sensitive": "too high",
      "safetyThresholds.self-harm/intent": "pair",
      form: "other",
    });
  });
});
