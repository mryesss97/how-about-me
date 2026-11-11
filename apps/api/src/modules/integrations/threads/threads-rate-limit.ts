import type { RateLimitInfo } from "./social-discovery.provider";

/**
 * Rate-limit metadata from Threads response headers (FR-089, TC-COL-026) — doc 06 §2/§9.
 * Header names follow the Graph API convention; the real Threads headers are not measured yet (POC §5.2),
 * so every header is optional. Only allow-listed headers are copied into `raw` (never cookies or auth).
 */
const ALLOWED = new Set(["x-app-usage", "x-business-use-case-usage", "x-fb-ads-insights-throttle", "retry-after"]);

function isAllowed(name: string) {
  return ALLOWED.has(name) || name.startsWith("x-ratelimit-");
}

function parseJson(value: string | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** `remaining` is a percentage (100 − highest usage %) when derived from `x-app-usage`. */
function remainingFrom(raw: Record<string, string>): number | undefined {
  const explicit = raw["x-ratelimit-remaining"];
  if (explicit !== undefined && /^\d+$/.test(explicit.trim())) return Number(explicit.trim());
  const usage = parseJson(raw["x-app-usage"]);
  if (!usage || typeof usage !== "object") return undefined;
  const u = usage as Record<string, unknown>;
  const pcts = ["call_count", "total_time", "total_cputime"]
    .map((k) => u[k])
    .filter((v): v is number => typeof v === "number");
  if (!pcts.length) return undefined;
  return Math.max(0, 100 - Math.max(...pcts));
}

/** `x-business-use-case-usage`: `{ "<id>": [{ estimated_time_to_regain_access: <minutes> }] }`. */
function resetAtFrom(raw: Record<string, string>, now: Date): Date | undefined {
  const parsed = parseJson(raw["x-business-use-case-usage"]);
  if (!parsed || typeof parsed !== "object") return undefined;
  let minutes = 0;
  for (const entries of Object.values(parsed as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries as unknown[]) {
      const m = e && typeof e === "object" ? (e as Record<string, unknown>)["estimated_time_to_regain_access"] : 0;
      if (typeof m === "number" && m > minutes) minutes = m;
    }
  }
  return minutes > 0 ? new Date(now.getTime() + minutes * 60_000) : undefined;
}

export function parseRateLimit(headers: Headers, now: Date): RateLimitInfo | undefined {
  const raw: Record<string, string> = {};
  headers.forEach((value, name) => {
    const key = name.toLowerCase();
    if (isAllowed(key)) raw[key] = value.slice(0, 500);
  });
  if (!Object.keys(raw).length) return undefined;
  const remaining = remainingFrom(raw);
  const resetAt = resetAtFrom(raw, now);
  return { raw, ...(remaining !== undefined ? { remaining } : {}), ...(resetAt ? { resetAt } : {}) };
}
