import { timingSafeEqual } from "node:crypto";

export type MetricsTokenCheck = "ok" | "missing" | "invalid";

/** Extracts the scrape token from `Authorization: Bearer <t>` or `x-metrics-token` (FR-174, doc 09 §2). */
export function extractMetricsToken(authorization: unknown, headerToken: unknown): string | undefined {
  if (typeof authorization === "string") {
    const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (m?.[1]) return m[1];
  }
  if (typeof headerToken === "string" && headerToken.length > 0) return headerToken;
  return undefined;
}

/** Timing-safe comparison; differing lengths never throw. */
export function checkMetricsToken(provided: string | undefined, expected: string): MetricsTokenCheck {
  if (!provided) return "missing";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // keep timing roughly constant
    return "invalid";
  }
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}
