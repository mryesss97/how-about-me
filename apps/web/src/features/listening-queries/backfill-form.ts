import type { BackfillBody, JobStatus, SearchType, SyncJobDetail } from "@how-about-me/contracts";
import { calendarRangeToInstants } from "@/lib/filters";

/** FE hint only; the server enforces `COLLECTOR_MAX_BACKFILL_DAYS` (FR-063). */
export const BACKFILL_MAX_DAYS = 30;
export const BACKFILL_DEFAULT_TZ = "Asia/Ho_Chi_Minh";

/** Calendar dates `YYYY-MM-DD` as picked in the dialog. */
export type CalendarRange = { start: string; end: string };

const DAY_MS = 86_400_000;
const dayNumber = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;

/** Today's calendar date in `tz`. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    now,
  );
}

/** Last `days` days ending today (inclusive) in `tz`. */
export function defaultRange(tz: string, now: Date = new Date(), days = 7): CalendarRange {
  const end = todayIn(tz, now);
  const start = new Date((dayNumber(end) - (days - 1)) * DAY_MS).toISOString().slice(0, 10);
  return { start, end };
}

/** Inline Vietnamese error, or null when valid (FR-063). The server stays the final check. */
export function validateBackfillRange(
  range: CalendarRange,
  now: Date = new Date(),
  tz = BACKFILL_DEFAULT_TZ,
  maxDays = BACKFILL_MAX_DAYS,
): string | null {
  const s = dayNumber(range.start);
  const e = dayNumber(range.end);
  if (Number.isNaN(s) || Number.isNaN(e)) return "Chọn ngày bắt đầu và kết thúc.";
  if (e < s) return "Ngày kết thúc phải sau ngày bắt đầu.";
  if (e > dayNumber(todayIn(tz, now))) return "Không thể chọn ngày trong tương lai.";
  if (e - s + 1 > maxDays) return `Tối đa ${maxDays} ngày.`;
  return null;
}

/** Day starts in `tz` → UTC ISO; `until` is clamped to now so the server's "until ≤ now" check passes. */
export function toBackfillBody(
  range: CalendarRange,
  searchType: SearchType,
  tz = BACKFILL_DEFAULT_TZ,
  now: Date = new Date(),
): BackfillBody {
  const { from, to } = calendarRangeToInstants(range.start, range.end, tz);
  const until = to.getTime() > now.getTime() ? now : to;
  return { since: from.toISOString(), until: until.toISOString(), searchType };
}

export const isTerminal = (status: JobStatus) => status !== "queued" && status !== "running";

/** Text label for every status — colour is never the only signal (BR-017). */
export const jobStatusLabel: Record<JobStatus, string> = {
  queued: "Đang chờ",
  running: "Đang chạy",
  success: "Thành công",
  partial: "Một phần",
  failed: "Lỗi",
  cancelled: "Đã huỷ",
};

export function progressSummary(
  job: Pick<SyncJobDetail, "pagesFetched" | "recordsFetched" | "recordsInserted" | "recordsDuplicated">,
) {
  return [
    { label: "Trang", value: job.pagesFetched },
    { label: "Đã lấy", value: job.recordsFetched },
    { label: "Mới", value: job.recordsInserted },
    { label: "Trùng", value: job.recordsDuplicated },
  ];
}
