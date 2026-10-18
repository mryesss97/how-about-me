import type {
  AnalysisTrigger,
  ListeningQuery,
  AuditAction,
  IntegrationStatus,
  JobStatus,
  JobTrigger,
  SystemStatusResponse,
} from "@how-about-me/contracts";
import { parseDate } from "@internationalized/date";
import { DASH, formatCount } from "@/lib/format/number";

import type { Tone } from "@/features/shared/status-plate";
import { TOKEN_WARN_DAYS, tokenDaysLeft } from "@/lib/semantics/token-expiry";

export type { Tone };
export { TOKEN_WARN_DAYS, tokenDaysLeft };
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

/** Audit entity types in Vietnamese (#56); unknown types are shown as stored. */
const AUDIT_ENTITY_LABEL_VI: Record<string, string> = {
  social_post: "Bài nhắc",
  analysis_override: "Ghi đè",
  analysis_run: "Lượt phân tích",
  analysis_settings: "Cài đặt phân tích",
  monitoring_project: "Dự án",
  project: "Dự án",
  member: "Thành viên",
  query: "Truy vấn",
  listening_query: "Truy vấn",
  integration: "Kết nối",
  integration_connection: "Kết nối",
  sync_job: "Lượt đồng bộ",
};

export function auditEntityLabel(type: string): string {
  return AUDIT_ENTITY_LABEL_VI[type] ?? type;
}

// ── Overview summary (#342, UX §3.6) ─────────────────────────────────────────────────────────────────────────

type Threads = SystemStatusResponse["threads"];

/** Threads plate: a connected token past expiry → "Đã hết hạn" (error); within 7 days → "Sắp hết hạn" (warning). */
export function threadsPlate(threads: Threads, nowMs: number): StatusLabel {
  if (threads.status === "connected") {
    const days = tokenDaysLeft(threads.tokenExpiresAt, nowMs);
    if (days != null && days <= 0) return { label: "Đã hết hạn", tone: "error" };
    if (days != null && days <= TOKEN_WARN_DAYS) return { label: "Sắp hết hạn", tone: "warning" };
  }
  return integrationStatusLabel[threads.status];
}

/** "classifier-v2 · taxonomy-v1": the `prompt`/`taxonomy` prefix is added only when the value lacks it. */
export function formatVersions(v: SystemStatusResponse["analysis"]["versions"]): string {
  const pre = (prefix: string, value: string | null) =>
    value ? (value.toLowerCase().startsWith(prefix) ? value : `${prefix} ${value}`) : null;
  return (
    [v.classifierModel, pre("prompt", v.promptVersion), pre("taxonomy", v.taxonomyVersion)]
      .filter(Boolean)
      .join(" · ") || DASH
  );
}

/**
 * Live (enabled, not deleted) queries whose sync dot is "Lỗi" — same rule as `syncStatus` in listening-queries
 * (UX §3.5; features may not import each other): last job failed, or never synced but has an error. An error
 * already followed by a successful sync is not counted.
 */
export function countQueriesWithError(
  queries: readonly Pick<ListeningQuery, "deletedAt" | "enabled" | "lastJob" | "lastError">[],
): number {
  return queries.filter((q) => !q.deletedAt && q.enabled && (q.lastJob ? q.lastJob.status === "failed" : !!q.lastError))
    .length;
}

export type SummaryClause = { text: string; href: string | null };
export type Summary = { ok: true } | { ok: false; clauses: SummaryClause[] };

export const FAILED_JOBS_HREF = "/system-status?tab=sync-jobs&status=failed";

/** Sync-jobs link for the collector: failed first; only partial → `status=partial` (one status per URL). */
export function failedJobsHref(failed: number, partial: number): string | null {
  if (failed > 0) return FAILED_JOBS_HREF;
  if (partial > 0) return "/system-status?tab=sync-jobs&status=partial";
  return null;
}

/**
 * One-line overview summary, most urgent first: Threads → collector → failed syncs → queries with errors → analyser.
 * `nowMs` should be the payload's `generatedAt` (server clock) so the result is stable and testable.
 */
export function buildSummary(args: {
  data: SystemStatusResponse;
  nowMs: number;
  queriesWithError: number | null;
  isAdmin: boolean;
}): Summary {
  const { data, nowMs, queriesWithError, isAdmin } = args;
  const { threads, collector, analysis } = data;
  const clauses: SummaryClause[] = [];
  // Settings is admin-only; non-admins get plain text (FR-015 is still enforced by the API).
  const settings = isAdmin ? "/settings/integrations" : null;
  if (threads.status === "expired" || threads.status === "permission_error" || threads.status === "error") {
    clauses.push({ text: "kết nối Threads lỗi", href: settings });
  } else if (threads.status === "connected") {
    const days = tokenDaysLeft(threads.tokenExpiresAt, nowMs);
    if (days != null && days <= 0) clauses.push({ text: "token Threads đã hết hạn", href: settings });
    else if (days != null && days <= TOKEN_WARN_DAYS)
      clauses.push({ text: `token Threads hết hạn sau ${formatCount(days)} ngày`, href: settings });
  }
  if (collector.status === "paused" || collector.circuit.open)
    clauses.push({ text: "bộ thu thập tạm dừng", href: null });
  if (collector.failedJobs24h > 0)
    clauses.push({
      text: `${formatCount(collector.failedJobs24h)} lượt đồng bộ lỗi trong 24 giờ`,
      href: FAILED_JOBS_HREF,
    });
  if (queriesWithError != null && queriesWithError > 0)
    clauses.push({ text: `${formatCount(queriesWithError)} truy vấn đang lỗi`, href: "/listening-queries" });
  if (analysis.failed24h > 0)
    clauses.push({
      text: `${formatCount(analysis.failed24h)} lượt phân tích lỗi trong 24 giờ`,
      href: "/system-status?tab=analysis-failures",
    });
  if (analysis.status === "budget_paused") clauses.push({ text: "bộ phân tích tạm dừng (ngân sách)", href: null });
  return clauses.length ? { ok: false, clauses } : { ok: true };
}

/** #343: number of non-empty fields in a collapsible filter panel ("Bộ lọc · n"). */
export function activeFilterCount(fields: Record<string, string>): number {
  return Object.values(fields).filter((v) => v !== "").length;
}
