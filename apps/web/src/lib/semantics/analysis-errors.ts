/** Analysis run error codes in Vietnamese (#93, #338); the raw code and message stay in the tooltip. */
const ANALYSIS_ERROR_LABEL_VI: Record<string, string> = {
  ANALYSIS_PROVIDER_ERROR: "Bộ phân tích đang lỗi",
  ANALYSIS_PROVIDER_AUTH: "Khoá API của bộ phân tích không hợp lệ",
  ANALYSIS_PROVIDER_BAD_REQUEST: "Bộ phân tích từ chối yêu cầu",
  ANALYSIS_SCHEMA_INVALID: "Kết quả phân tích sai định dạng",
  LLM_TIMEOUT: "Bộ phân tích phản hồi quá lâu",
  CLASSIFIER_TIMEOUT: "Bộ phân tích phản hồi quá lâu",
  INTERNAL: "Lỗi hệ thống",
};

export const UNKNOWN_ANALYSIS_ERROR_LABEL = "Lỗi phân tích không xác định";

/** Vietnamese label for an analysis error code; unknown codes never surface the raw code as main text (#338). */
export function analysisErrorLabel(code: string): string {
  return ANALYSIS_ERROR_LABEL_VI[code] ?? UNKNOWN_ANALYSIS_ERROR_LABEL;
}

/** Tooltip text: the raw code, plus the provider message when there is one. */
export function analysisErrorTitle(code: string, message?: string | null): string {
  return message ? `${code}: ${message}` : code;
}
