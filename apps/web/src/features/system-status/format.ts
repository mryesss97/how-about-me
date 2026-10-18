import type {
  AnalysisTrigger,
  AuditAction,
  IntegrationStatus,
  JobStatus,
  JobTrigger,
  SystemStatusResponse,
} from "@how-about-me/contracts";
import { parseDate } from "@internationalized/date";
import { DASH } from "@/lib/format/number";

export type Tone = "success" | "warning" | "error" | "progress" | "neutral";
export type StatusLabel = { label: string; tone: Tone };

/** Lag in seconds → "45 giây" / "12 phút" / "3 giờ"; null → "—". */
export function formatLag(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return DASH;
  if (seconds < 60) return `${seconds} giây`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút`;
  return `${Math.floor(seconds / 3600)} giờ`;
}

/** Job duration from start/end; null when either side is missing. */
export function jobDurationSeconds(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  return Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000));
}

// BR-017: every status maps to a text label, never colour alone.
export const integrationStatusLabel: Record<IntegrationStatus, StatusLabel> = {
  connected: { label: "Đã kết nối", tone: "success" },
  disconnected: { label: "Chưa kết nối", tone: "neutral" },
  expired: { label: "Lỗi: token hết hạn", tone: "error" },
  permission_error: { label: "Lỗi: thiếu quyền", tone: "error" },
  error: { label: "Lỗi", tone: "error" },
};

export const collectorStatusLabel: Record<SystemStatusResponse["collector"]["status"], StatusLabel> = {
  healthy: { label: "Hoạt động tốt", tone: "success" },
  degraded: { label: "Chậm", tone: "warning" },
  paused: { label: "Tạm dừng", tone: "error" },
};

export const analysisStatusLabel: Record<SystemStatusResponse["analysis"]["status"], StatusLabel> = {
  healthy: { label: "Hoạt động tốt", tone: "success" },
  degraded: { label: "Chậm", tone: "warning" },
  budget_paused: { label: "Tạm dừng (ngân sách)", tone: "error" },
};

export const jobStatusLabel: Record<JobStatus, StatusLabel> = {
  queued: { label: "Đang chờ", tone: "progress" },
  running: { label: "Đang chạy", tone: "progress" },
  success: { label: "Thành công", tone: "success" },
  partial: { label: "Một phần", tone: "warning" },
  failed: { label: "Thất bại", tone: "error" },
  cancelled: { label: "Đã huỷ", tone: "neutral" },
};

export const jobTriggerLabel: Record<JobTrigger, string> = {
  scheduled: "Theo lịch",
  manual: "Thủ công",
  backfill: "Quét bù",
  retry: "Thử lại",
};

export const analysisTriggerLabel: Record<AnalysisTrigger, string> = {
  ingest: "Thu thập",
  content_change: "Nội dung đổi",
  manual: "Thủ công",
  bulk: "Hàng loạt",
  retry: "Thử lại",
  version_change: "Đổi phiên bản",
};

/** `YYYY-MM-DD` (calendar day in `tz`) → UTC ISO start of that day. */
export function dayStartUtc(day: string, tz: string): string {
  return parseDate(day).toDate(tz).toISOString();
}

/** `YYYY-MM-DD` → UTC ISO of the last millisecond of that day in `tz`. */
export function dayEndUtc(day: string, tz: string): string {
  return new Date(parseDate(day).add({ days: 1 }).toDate(tz).getTime() - 1).toISOString();
}

export function truncateMiddle(s: string, max = 24): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

/** FR-201: Vietnamese labels for audit actions (docs/02-architecture/08-security-secrets.md §6). */
export const auditActionLabel: Record<AuditAction, string> = {
  "project.updated": "Cập nhật dự án",
  "member.added": "Thêm thành viên",
  "member.role_changed": "Đổi vai trò thành viên",
  "member.removed": "Xoá thành viên",
  "integration.updated": "Cập nhật kết nối Threads",
  "integration.verified": "Kiểm tra kết nối Threads",
  "integration.disconnected": "Ngắt kết nối Threads",
  "integration.refresh_failed": "Làm mới token thất bại",
  "query.created": "Tạo truy vấn",
  "query.updated": "Sửa truy vấn",
  "query.enabled": "Bật truy vấn",
  "query.disabled": "Tắt truy vấn",
  "query.deleted": "Xoá truy vấn",
  "query.restored": "Khôi phục truy vấn",
  "query.run_requested": "Yêu cầu chạy truy vấn",
  "query.backfill_requested": "Yêu cầu quét bù",
  "analysis.reanalyze_requested": "Yêu cầu phân tích lại",
  "analysis.bulk_reanalyze_requested": "Yêu cầu phân tích lại hàng loạt",
  "analysis.retry_requested": "Thử lại phân tích",
  "override.created": "Tạo chỉnh sửa nhãn",
  "override.revoked": "Thu hồi chỉnh sửa nhãn",
  "review.marked": "Đánh dấu đã xem xét",
  "mentions.exported": "Xuất dữ liệu đề cập",
  "analysis_settings.updated": "Cập nhật cài đặt phân tích",
  "sync_job.retry_requested": "Thử lại lượt đồng bộ",
  "data.purged": "Xoá dữ liệu",
};

/** Label for an action; unknown (legacy) actions fall back to the raw string. */
export function auditActionText(action: string): string {
  return (auditActionLabel as Record<string, string | undefined>)[action] ?? action;
}

/** `YYYY-MM-DD` → UTC ISO start of the *next* day in `tz` (exclusive upper bound, audit API `to`). */
export function nextDayStartUtc(day: string, tz: string): string {
  return parseDate(day).add({ days: 1 }).toDate(tz).toISOString();
}
