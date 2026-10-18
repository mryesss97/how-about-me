/** Shown instead of a time when nothing has synced yet (landing #271, overview fascia #336). */
export const NEVER_SYNCED = "Chưa đồng bộ";

/** "5 phút trước" / "3 giờ trước", else "14/10 09:30" in the given timezone (#271, shared with #336). */
export function viUpdated(iso: string, now: Date, timeZone: string): string {
  const min = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  if (min < 24 * 60) return `${Math.round(min / 60)} giờ trước`;
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")} ${p("hour")}:${p("minute")}`;
}
