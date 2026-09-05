import { env } from "@/lib/env";

/** Absolute time in a timezone (default project/default tz) — ADR-0011. */
export function formatDateTime(
  iso: string | Date,
  timeZone: string = env.NEXT_PUBLIC_DEFAULT_TIMEZONE,
  opts: Intl.DateTimeFormatOptions = {},
) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone, ...opts }).format(d);
}

/** Relative time for < 24h, else absolute. */
export function formatRelativeOrAbsolute(iso: string | Date, now: Date = new Date(), timeZone?: string) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} h ago`;
  return formatDateTime(d, timeZone);
}

export function tzLabel(timeZone: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(at);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${off} · ${timeZone}`;
}
