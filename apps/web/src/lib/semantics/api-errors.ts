import type { ErrorCode } from "@how-about-me/contracts";
import { ApiError } from "@/lib/api/client";
import { analysisErrorLabel } from "./analysis-errors";
import { syncErrorLabel } from "./sync-errors";

/**
 * Load-error copy in Vietnamese (#392, UX §5). The API's own `message` is a technical English string and is
 * never shown as body text — only the code and requestId, in the small mono line of `ErrorState`.
 */

/** Client-only codes from `lib/api/client.ts` (not in contracts/errors.ts). */
type ClientErrorCode = "NETWORK_ERROR" | "UNKNOWN";

export const FORBIDDEN_MESSAGE_VI = "Bạn không có quyền thực hiện thao tác này.";
export const SERVER_ERROR_MESSAGE_VI = "Máy chủ gặp sự cố. Thử lại sau ít phút.";
export const INVALID_RESPONSE_MESSAGE_VI = "Phản hồi không hợp lệ từ máy chủ.";
export const UNKNOWN_ERROR_MESSAGE_VI = "Đã xảy ra lỗi. Thử lại sau giây lát.";

const AUTH_MESSAGE_VI = "Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử lại.";
const sentence = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const sync = (code: string) => sentence(syncErrorLabel(code, ""));
const analysis = (code: string) => sentence(analysisErrorLabel(code));

// `Record<ErrorCode, …>` on purpose: a new contract code fails typecheck until it has copy here.
const API_ERROR_MESSAGE_VI: Record<ErrorCode | ClientErrorCode, string> = {
  VALIDATION_ERROR: "Yêu cầu không hợp lệ.",
  QUERY_IMMUTABLE_FIELD: "Không thể đổi trường này của truy vấn.",
  BACKFILL_WINDOW_INVALID: "Khoảng thời gian lấy lại dữ liệu không hợp lệ.",
  AUTH_MISSING_TOKEN: AUTH_MESSAGE_VI,
  AUTH_INVALID_TOKEN: AUTH_MESSAGE_VI,
  AUTH_TOKEN_EXPIRED: AUTH_MESSAGE_VI,
  FORBIDDEN_ROLE: FORBIDDEN_MESSAGE_VI,
  FORBIDDEN_PROJECT: FORBIDDEN_MESSAGE_VI,
  NOT_FOUND: "Không tìm thấy dữ liệu này.",
  QUERY_DUPLICATE: "Truy vấn này đã tồn tại.",
  SYNC_ALREADY_RUNNING: "Đang có lượt đồng bộ chạy cho truy vấn này.",
  SYNC_JOB_NOT_RETRYABLE: "Lượt đồng bộ này không thể chạy lại.",
  ANALYSIS_RUN_NOT_RETRYABLE: "Lượt phân tích này không thể chạy lại.",
  LAST_ADMIN: "Dự án cần ít nhất một quản trị viên.",
  MEMBER_EXISTS: "Thành viên này đã có trong dự án.",
  ANALYSIS_ALREADY_PENDING: "Bài này đang chờ phân tích.",
  OVERRIDE_CONFLICT: "Dữ liệu vừa được người khác sửa. Tải lại rồi thử lại.",
  INTEGRATION_NOT_CONFIGURED: sync("INTEGRATION_NOT_CONFIGURED"),
  EXPORT_TOO_LARGE: "Dữ liệu xuất quá lớn. Hãy thu hẹp bộ lọc.",
  RATE_LIMITED: "Thao tác quá nhanh, thử lại sau ít phút.",
  INTERNAL: SERVER_ERROR_MESSAGE_VI,
  ANALYSIS_SCHEMA_INVALID: SERVER_ERROR_MESSAGE_VI,
  ANALYSIS_PROVIDER_ERROR: analysis("ANALYSIS_PROVIDER_ERROR"),
  ANALYSIS_PROVIDER_AUTH: analysis("ANALYSIS_PROVIDER_AUTH"),
  ANALYSIS_PROVIDER_BAD_REQUEST: analysis("ANALYSIS_PROVIDER_BAD_REQUEST"),
  THREADS_UNAUTHORIZED: sync("THREADS_UNAUTHORIZED"),
  THREADS_FORBIDDEN: sync("THREADS_FORBIDDEN"),
  THREADS_UPSTREAM_ERROR: sync("THREADS_UPSTREAM_ERROR"),
  THREADS_MALFORMED_RESPONSE: sync("THREADS_MALFORMED_RESPONSE"),
  THREADS_RATE_LIMITED: sync("THREADS_RATE_LIMITED"),
  THREADS_TIMEOUT: sync("THREADS_TIMEOUT"),
  NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
  // Proxy 502/504 or a non-JSON body: the network is fine, the server is not answering.
  UNKNOWN: "Máy chủ tạm thời không phản hồi. Thử lại sau ít phút.",
};

/** Vietnamese sentence for an error; never returns the original `message` (#392). */
export function apiErrorMessageVi(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err && typeof err.code === "string" ? err.code : undefined;
  if (!code) return INVALID_RESPONSE_MESSAGE_VI;
  return (API_ERROR_MESSAGE_VI as Record<string, string>)[code] ?? UNKNOWN_ERROR_MESSAGE_VI;
}

/** `QueryState` error from a TanStack Query error; non-`ApiError` means the response failed Zod parsing. */
export function toQueryStateError(err: unknown): { code?: string; message?: string; requestId?: string } | null {
  if (!err) return null;
  if (err instanceof ApiError) return { code: err.code, message: err.message, requestId: err.requestId };
  return { message: INVALID_RESPONSE_MESSAGE_VI };
}
