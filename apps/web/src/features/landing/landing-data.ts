import type { LandingTermsResponse, OverviewResponse } from "@how-about-me/contracts";
import type { BubbleDatum } from "@/features/shared/bubbles/bubble-layout";
import { bubbleCopy } from "@/features/shared/bubbles/sentiment-style";
import { DASH, formatCount, formatGrowth, formatRate, type GrowthState } from "@/lib/format/number";
import { formatRelativeOrAbsolute } from "@/lib/time/format";
import { landingCopy as copy } from "./copy";

/** Landing balloon = shared bubble + `empty` flag for terms with 0 mentions (#262). */
export type LandingBubble = BubbleDatum & { empty: boolean };

/**
 * BR-042, FR-149 (#262): every configured term becomes a balloon, in setting order. A term with total 0 still
 * shows (neutral grey, share 0) so admins see that it is configured; its radius comes from the layout floor.
 */
export function toLandingBubbles(rows: LandingTermsResponse["rows"]): LandingBubble[] {
  return rows.map((r) => ({
    key: r.term,
    name: r.term,
    positive: r.positive,
    neutral: r.neutral,
    negative: r.negative,
    total: r.total,
    dominant: r.dominant ?? "neutral",
    dominantShare: r.dominantShare ?? 0,
    empty: r.total <= 0 || r.dominant === null,
  }));
}

/** Tooltip / accessible name: "term · 62.0% positive · 128 mentions"; empty → "term · no mentions". */
export function balloonLabel(b: LandingBubble): string {
  if (b.empty) return `${b.name} · ${copy.noMentions}`;
  return `${b.name} · ${bubbleCopy.shareLine(b.dominantShare, b.dominant)} · ${bubbleCopy.mentions(b.total)}`;
}

export type GrowthDirection = "up" | "down" | "flat" | "new";
/** Growth badge (#267): `text` is capped at ">999%", `aria` keeps the exact value ("+14150.0%"). */
export type LandingGrowth = { text: string; direction: GrowthDirection; aria: string };
export type LandingStat = {
  key: keyof typeof copy.stats;
  label: string;
  value: string;
  growth: LandingGrowth | null;
};

/** Growth cap shown on the badge (#267). */
export const GROWTH_CAP = 999;

export function landingGrowth(pct: number | null | undefined, state: GrowthState): LandingGrowth | null {
  const aria = formatGrowth(pct, state);
  if (aria === DASH) return null;
  if (state === "new" || state === "flat" || pct == null)
    return { text: aria, direction: state === "new" ? "new" : "flat", aria };
  const direction: GrowthDirection = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const text = Math.abs(pct) > GROWTH_CAP ? `>${GROWTH_CAP}%` : `${Math.abs(pct).toFixed(1)}%`;
  return { text, direction, aria };
}

/**
 * The 4 landing stats (#262) from the overview response over the landing range. Safety is never shown here:
 * sentiment ≠ safety (BR-017). Mentions carries a growth badge (↑/↓ %, "New", "0%"); hidden when not computable.
 */
export function formatLandingStats(o: OverviewResponse, now: Date = new Date()): LandingStat[] {
  const m = o.kpis.mentionCount;
  const lastSyncAt = o.dataQuality.lastSyncAt;
  return [
    {
      key: "mentions",
      label: copy.stats.mentions,
      value: formatCount(m.value),
      growth: landingGrowth(m.growthPct, m.growthState),
    },
    { key: "positive", label: copy.stats.positive, value: formatRate(o.kpis.positiveRate.value), growth: null },
    { key: "negative", label: copy.stats.negative, value: formatRate(o.kpis.negativeRate.value), growth: null },
    {
      key: "lastUpdated",
      label: copy.stats.lastUpdated,
      value: lastSyncAt ? formatRelativeOrAbsolute(lastSyncAt, now, o.range.timezone) : copy.neverSynced,
      growth: null,
    },
  ];
}

/** Fallback range when landing-terms failed (open question 1 of the plan): last 30 days in the project timezone. */
export function fallbackRange(now: Date, timezone: string): { from: string; to: string; timezone: string } {
  const to = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const from = new Date(to.getTime() - 30 * 24 * 3600_000);
  return { from: from.toISOString(), to: to.toISOString(), timezone };
}
