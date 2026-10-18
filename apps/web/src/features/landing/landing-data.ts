import type { LandingTermsResponse, OverviewResponse } from "@how-about-me/contracts";
import { landingCopy as copy } from "./copy";

export type Sentiment = "positive" | "neutral" | "negative";

/** One signboard (#271): a configured phrase with its 30-day sentiment split (BR-042, FR-149). */
export type LandingBoard = {
  key: string;
  name: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  dominant: Sentiment;
  dominantShare: number;
  /** 0 mentions: a blank board, still shown so admins see the phrase is configured. */
  empty: boolean;
};

/** Every configured phrase becomes a board, in setting order (BR-042). */
export function toLandingBoards(rows: LandingTermsResponse["rows"]): LandingBoard[] {
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

/** Rank by mentions, ties keep setting order (rank plates, #271). */
export function boardRanks(boards: readonly LandingBoard[]): Map<string, number> {
  const order = boards
    .map((b, i) => ({ key: b.key, total: b.total, i }))
    .sort((a, b) => b.total - a.total || a.i - b.i);
  return new Map(order.map((o, i) => [o.key, i + 1]));
}

/** Enamel tone (#271): solid when one sentiment clearly leads, white board with coloured lettering when mixed. */
export type BoardTone = "blank" | "positive-solid" | "negative-solid" | "positive-mixed" | "negative-mixed" | "neutral";
export const SOLID_SHARE = 0.6;
export function boardTone(b: LandingBoard): BoardTone {
  if (b.empty) return "blank";
  if (b.dominant === "neutral") return "neutral";
  return `${b.dominant}-${b.dominantShare >= SOLID_SHARE ? "solid" : "mixed"}`;
}

const vi = (min: number, max: number) =>
  new Intl.NumberFormat("vi-VN", { minimumFractionDigits: min, maximumFractionDigits: max });
const pct1 = vi(1, 1);
const int = vi(0, 0);

/** "23,5%" — Vietnamese decimal comma (#271). */
export const viRate = (v: number | null | undefined) => (v == null ? "—" : `${pct1.format(v * 100)}%`);
/** "1.284" — Vietnamese thousands dot (#271). */
export const viCount = (n: number) => int.format(n);

/** Accessible name of a board: `"giá vé" · 62,0% tích cực · 100 bài nhắc`. */
export function boardLabel(b: LandingBoard): string {
  if (b.empty) return `"${b.name}" · ${copy.noMentions}`;
  return `"${b.name}" · ${viRate(b.dominantShare)} ${copy.sentiment[b.dominant]} · ${copy.mentions(viCount(b.total))}`;
}

/** Full split for the hover sub-sign: "100 bài nhắc · 62,0% tích cực · 38,0% trung tính · 0,0% tiêu cực". */
export function boardSplit(b: LandingBoard): string {
  if (b.empty) return copy.noMentions;
  const share = (n: number) => viRate(b.total > 0 ? n / b.total : 0);
  return [
    copy.mentions(viCount(b.total)),
    `${share(b.positive)} ${copy.sentiment.positive}`,
    `${share(b.neutral)} ${copy.sentiment.neutral}`,
    `${share(b.negative)} ${copy.sentiment.negative}`,
  ].join(" · ");
}

export type GrowthDirection = "up" | "down" | "flat";
/** Growth figure (#267, #271): `text` capped at ">999%" (direction drawn as an icon), `aria` keeps the exact value. */
export type LandingGrowth = { text: string; direction: GrowthDirection; aria: string };
export const GROWTH_CAP = 999;

export function landingGrowth(
  pct: number | null | undefined,
  state: OverviewResponse["kpis"]["mentionCount"]["growthState"],
): LandingGrowth | null {
  // #334: no "Mới" badge — a new period shows its figure with "kỳ trước: 0" instead.
  if (state === "new") return null;
  if (pct == null) return null;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const aria = `${sign}${pct1.format(Math.abs(pct))}%`;
  const direction: GrowthDirection = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const text = Math.abs(pct) > GROWTH_CAP ? `>${GROWTH_CAP}%` : `${pct1.format(Math.abs(pct))}%`;
  return { text, direction, aria };
}

export type LandingStat = {
  key: keyof typeof copy.stats;
  value: string;
  label: string;
  growth: LandingGrowth | null;
  /** Small print under the figure, e.g. the previous period's count behind a growth figure. */
  note?: string;
  /** A state rather than a number ("Chưa đồng bộ"): set as small print, not as a painted figure. */
  status?: boolean;
};

/** "5 phút trước" / "3 giờ trước", else "14/10 09:30" in the range timezone (#271). */
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

/**
 * The 4 painted figures of the main sign (#262, #271) from the overview over the landing range. Safety is never
 * shown here: sentiment ≠ safety (BR-017).
 */
export function formatLandingStats(o: OverviewResponse, now: Date = new Date()): LandingStat[] {
  const m = o.kpis.mentionCount;
  const lastSyncAt = o.dataQuality.lastSyncAt;
  return [
    {
      key: "mentions",
      value: viCount(m.value),
      label: copy.stats.mentions,
      growth: landingGrowth(m.growthPct, m.growthState),
      // The base behind the growth figure, so a jump from a nearly empty previous period reads as such.
      note:
        m.growthState === "new"
          ? copy.previous(viCount(0)) // "new" ⇔ nothing in the previous period
          : m.previous != null
            ? copy.previous(viCount(m.previous))
            : undefined,
    },
    { key: "positive", value: viRate(o.kpis.positiveRate.value), label: copy.stats.positive, growth: null },
    { key: "negative", value: viRate(o.kpis.negativeRate.value), label: copy.stats.negative, growth: null },
    {
      key: "lastUpdated",
      value: lastSyncAt ? viUpdated(lastSyncAt, now, o.range.timezone) : copy.neverSynced,
      label: copy.stats.lastUpdated,
      growth: null,
      status: !lastSyncAt,
    },
  ];
}

/** Fallback range when landing-terms failed: last 30 days, so the figures still show. */
export function fallbackRange(now: Date, timezone: string): { from: string; to: string; timezone: string } {
  const to = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const from = new Date(to.getTime() - 30 * 24 * 3600_000);
  return { from: from.toISOString(), to: to.toISOString(), timezone };
}
