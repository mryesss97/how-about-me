import type { Override, OverrideField, UserRef } from "@how-about-me/contracts";
import { formatDateTime } from "@/lib/time/format";
import { humanize } from "./format";

export const FIELD_LABELS: Record<OverrideField, string> = {
  relevance: "Relevance",
  sentiment: "Sentiment",
  safety_level: "Safety level",
  intents: "Intents",
  topics: "Topics",
};

/**
 * Active (non-revoked) override per field — BR-025: an active override wins over the latest AI value.
 * The server keeps at most one active per field; if several slip through, the newest wins.
 */
export function activeOverrides(overrides: readonly Override[] | undefined): Partial<Record<OverrideField, Override>> {
  const out: Partial<Record<OverrideField, Override>> = {};
  for (const o of overrides ?? []) {
    if (o.revokedAt != null) continue;
    const cur = out[o.field];
    if (!cur || Date.parse(o.createdAt) > Date.parse(cur.createdAt)) out[o.field] = o;
  }
  return out;
}

/** Narrow an override `value`/`previousValue` (`unknown` in the contract) to a single label. */
export function asLabel(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Narrow an override `value`/`previousValue` to a label list; non-string entries are dropped. */
export function asLabels(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  const one = asLabel(v);
  return one ? [one] : [];
}

/** Human text for an override value, single or multi. `null` / empty → "—". */
export function formatValue(v: unknown): string {
  const labels = asLabels(v);
  return labels.length ? labels.map(humanize).join(", ") : "—";
}

export const userName = (u: UserRef | null | undefined) => u?.displayName ?? u?.email ?? "Unknown user";

/** Tooltip text on the Analyst badge (FR-194). */
export function overrideTooltip(o: Override, tz: string): string {
  const parts = [`Overridden by ${userName(o.reviewedBy)}`, formatDateTime(o.createdAt, tz)];
  if (o.reason) parts.push(`Reason: ${o.reason}`);
  return parts.join(" · ");
}
