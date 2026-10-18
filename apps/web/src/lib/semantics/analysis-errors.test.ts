import { describe, expect, it } from "vitest";
import { analysisErrorLabel, analysisErrorTitle } from "./analysis-errors";

describe("analysisErrorLabel (#338, FR-156)", () => {
  it.each([
    ["ANALYSIS_PROVIDER_ERROR", "Bộ phân tích đang lỗi"],
    ["ANALYSIS_PROVIDER_AUTH", "Khoá API của bộ phân tích không hợp lệ"],
    ["ANALYSIS_PROVIDER_BAD_REQUEST", "Bộ phân tích từ chối yêu cầu"],
    ["ANALYSIS_SCHEMA_INVALID", "Kết quả phân tích sai định dạng"],
    ["LLM_TIMEOUT", "Bộ phân tích phản hồi quá lâu"],
    ["CLASSIFIER_TIMEOUT", "Bộ phân tích phản hồi quá lâu"],
    ["INTERNAL", "Lỗi hệ thống"],
  ])("%s → Vietnamese label", (code, label) => {
    expect(analysisErrorLabel(code)).toBe(label);
  });

  it("unknown code never becomes the main text", () => {
    const l = analysisErrorLabel("CLASSIFIER_X");
    expect(l).toBe("Lỗi phân tích không xác định");
    expect(l).not.toContain("CLASSIFIER_X");
  });

  it("title joins code and message", () => {
    expect(analysisErrorTitle("LLM_TIMEOUT", "took 30s")).toBe("LLM_TIMEOUT: took 30s");
    expect(analysisErrorTitle("LLM_TIMEOUT")).toBe("LLM_TIMEOUT");
  });
});
