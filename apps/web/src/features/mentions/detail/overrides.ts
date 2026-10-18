import type { MentionDetail, Override, OverrideField, UserRef } from "@how-about-me/contracts";
import { formatDateTime } from "@/lib/time/format";
import { displayLabel, type LabelKind } from "@/lib/semantics/labels";

export const FIELD_LABELS: Record<OverrideField, string> = {
  relevance: "Mức liên quan",
  sentiment: "Cảm xúc",
  safety_level: "Mức an toàn",
  intents: "Ý định",
  topics: "Chủ đề",
};

/** Label table for each overridable field — enum values stay English, only the text is Vietnamese (#277). */
export const FIELD_KIND: Record<OverrideField, LabelKind> = {
  relevance: "relevance",
  sentiment: "sentiment",
  safety_level: "safety",
  intents: "intent",
  topics: "topic",
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
export function formatValue(v: unknown, field: OverrideField): string {
  const labels = asLabels(v);
  return labels.length ? labels.map((l) => displayLabel(FIELD_KIND[field], l)).join(", ") : "—";
}

export const userName = (u: UserRef | null | undefined) => u?.displayName ?? u?.email ?? "Người dùng không rõ";

/** Tooltip text on the "Chuyên viên" (analyst) badge (FR-194). */
export function overrideTooltip(o: Override, tz: string): string {
  const parts = [`Ghi đè bởi ${userName(o.reviewedBy)}`, formatDateTime(o.createdAt, tz)];
  if (o.reason) parts.push(`Lý do: ${o.reason}`);
  return parts.join(" · ");
}

/**
 * Field the toolbar "Ghi đè" preselects (#338). FR-195: an "uncertain" mention's open question is
 * whether it is relevant at all, so relevance comes first; otherwise sentiment.
 */
export function defaultOverrideField(m: Pick<MentionDetail, "analysis">): OverrideField {
  return m.analysis.relevance?.label === "uncertain" ? "relevance" : "sentiment";
}
