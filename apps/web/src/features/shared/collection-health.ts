import type { SystemStatusResponse } from "@how-about-me/contracts";
import { formatCount } from "@/lib/format/number";
import { TOKEN_WARN_DAYS, tokenDaysLeft } from "@/lib/semantics/token-expiry";

/** Failed sync jobs on System Status (#342); shared so the shell strip can link there (#345). */
export const FAILED_JOBS_HREF = "/system-status?tab=sync-jobs&status=failed";
export const INTEGRATIONS_HREF = "/settings/integrations";

export type HealthNoticeKind = "threads" | "not-connected" | "collector-paused" | "token-soon";
export type HealthNotice = {
  kind: HealthNoticeKind;
  tone: "error" | "warning";
  title: string;
  description: string;
  /** Admin only (BR-033); other roles are told to contact the project admin. */
  action: { href: string; label: string } | null;
};
export type NavHealth = { level: "error" | "warning"; word: string };

type Opts = { isAdmin: boolean; nowMs: number; timeZone?: string };

const CONTACT_ADMIN = " Hãy liên hệ quản trị dự án.";
const OPEN_INTEGRATIONS = { href: INTEGRATIONS_HREF, label: "Mở Kết nối" };

const isThreadsBroken = (t: SystemStatusResponse["threads"]) =>
  t.status === "expired" || t.status === "permission_error" || t.status === "error";

/** "23/10" in the project timezone. */
function dayMonth(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit", month: "2-digit" }).formatToParts(
    new Date(iso),
  );
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}`;
}

/**
 * #345 (flows-4): the single shell strip under the fascia — highest priority wins:
 * Threads broken/expired → not connected → collector paused → (admin) token expiring within 7 days (FR-046).
 * `nowMs` should be `generatedAt` (server clock, like `buildSummary` #342). Links are admin-only (BR-033, FR-015).
 */
export function collectionNotice(data: SystemStatusResponse, opts: Opts): HealthNotice | null {
  const { isAdmin, nowMs, timeZone = "Asia/Ho_Chi_Minh" } = opts;
  const { threads, collector } = data;
  const days = threads.status === "connected" ? tokenDaysLeft(threads.tokenExpiresAt, nowMs) : null;
  const contact = isAdmin ? "" : CONTACT_ADMIN;
  if (isThreadsBroken(threads) || (days != null && days <= 0))
    return {
      kind: "threads",
      tone: "error",
      title: "Kết nối Threads cần được xử lý.",
      description: `Việc thu thập đang tạm dừng.${contact}`,
      action: isAdmin ? OPEN_INTEGRATIONS : null,
    };
  if (threads.status === "disconnected")
    return {
      kind: "not-connected",
      tone: "error",
      title: "Chưa kết nối Threads.",
      description: `Chưa thu thập bài nhắc mới.${contact}`,
      action: isAdmin ? OPEN_INTEGRATIONS : null,
    };
  if (collector.status === "paused" || collector.circuit.open)
    return {
      kind: "collector-paused",
      tone: "error",
      title: "Bộ thu thập đang tạm dừng.",
      description: `Số liệu mới có thể bị chậm.${contact}`,
      action: isAdmin ? { href: FAILED_JOBS_HREF, label: "Xem lượt lỗi" } : null,
    };
  if (isAdmin && days != null && days <= TOKEN_WARN_DAYS && threads.tokenExpiresAt)
    return {
      kind: "token-soon",
      tone: "warning",
      title: `Token Threads hết hạn ngày ${dayMonth(threads.tokenExpiresAt, timeZone)} (còn ${formatCount(days)} ngày).`,
      description: "Cập nhật token để việc thu thập không bị gián đoạn.",
      action: OPEN_INTEGRATIONS,
    };
  return null;
}

/** #345: dot + word on the "Trạng thái hệ thống" nav item (BR-017: never colour alone); null = healthy. */
export function navHealth(data: SystemStatusResponse, opts: Opts): NavHealth | null {
  const notice = collectionNotice(data, opts);
  if (notice?.tone === "error") return { level: "error", word: "Lỗi" };
  if (data.collector.status === "degraded" || data.analysis.status !== "healthy")
    return { level: "warning", word: "Chậm" };
  if (notice?.kind === "token-soon") return { level: "warning", word: "Sắp hết hạn" };
  return null;
}
