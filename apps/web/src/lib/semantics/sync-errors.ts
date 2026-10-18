/** Shared by Listening Queries (#42) and System Status (#55). */
/** Sync error codes in Vietnamese (#42, #55); the provider's raw message stays in the tooltip. */
const SYNC_ERROR_LABEL_VI: Record<string, string> = {
  THREADS_RATE_LIMITED: "Threads giới hạn tần suất gọi",
  THREADS_UNAUTHORIZED: "Token Threads không hợp lệ hoặc đã hết hạn",
  THREADS_FORBIDDEN: "Token Threads thiếu quyền",
  THREADS_TIMEOUT: "Threads phản hồi quá lâu",
  THREADS_UPSTREAM_ERROR: "Threads đang lỗi",
  THREADS_MALFORMED_RESPONSE: "Threads trả dữ liệu không đọc được",
  INTEGRATION_NOT_CONFIGURED: "Chưa có token Threads",
  INTERNAL: "Lỗi hệ thống",
};

/** Vietnamese label for a sync error code; unknown codes fall back to the (truncated) provider message. */
export function syncErrorLabel(code: string, message: string): string {
  return SYNC_ERROR_LABEL_VI[code] ?? truncate(message);
}

function truncate(msg: string, max = 60): string {
  return msg.length <= max ? msg : `${msg.slice(0, max - 1).trimEnd()}…`;
}
