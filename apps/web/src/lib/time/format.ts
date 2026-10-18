import { fromDate } from "@internationalized/date";
import { env } from "@/lib/env";

/** Absolute time in a timezone (default project/default tz) — ADR-0011. vi-VN since #277. */
export function formatDateTime(
  iso: string | Date,
  timeZone: string = env.NEXT_PUBLIC_DEFAULT_TIMEZONE,
  opts: Intl.DateTimeFormatOptions = {},
) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone, ...opts }).format(d);
}

/** Relative time for < 24h (Vietnamese, #277), else absolute. */
export function formatRelativeOrAbsolute(iso: string | Date, now: Date = new Date(), timeZone?: string) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} giờ trước`;
  return formatDateTime(d, timeZone);
}

/**
 * `GMT+7` for `timeZone` at `at` (#388, chart subtitles). The offset is computed, not taken from ICU `shortOffset`,
 * because Node and browsers format it differently (`GMT` vs `GMT+0`) and that breaks hydration.
 */
export function tzOffsetLabel(timeZone: string, at: Date = new Date()) {
  const offsetMin = Math.round(fromDate(at, timeZone).offset / 60_000);
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const mins = abs % 60;
  return `GMT${sign}${Math.floor(abs / 60)}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
}

/** `GMT+7 · Asia/Ho_Chi_Minh` — only for the Múi giờ select. */
export function tzLabel(timeZone: string, at: Date = new Date()) {
  return `${tzOffsetLabel(timeZone, at)} · ${timeZone}`;
}

/**
 * Compact "HH:mm dd/MM" in `timeZone` (#344, History tables). Built from parts because vi-VN `{day, month}` formats
 * as "17-10"; `h23` avoids "24:05" at midnight. No year — callers put the full date in `title`.
 */
export function formatShortDateTime(iso: string | Date, timeZone: string = env.NEXT_PUBLIC_DEFAULT_TIMEZONE) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("day")}/${get("month")}`;
}
