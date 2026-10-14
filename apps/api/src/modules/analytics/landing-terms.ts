import type { LandingTermRow } from "@how-about-me/contracts";

export type LandingTermCell = { ord: number; sentiment: string; count: number };
type Sentiment = "positive" | "neutral" | "negative";

/** Tie-break order for `dominant` — same as the bubble map (negative > positive > neutral). */
const DOMINANCE: readonly Sentiment[] = ["negative", "positive", "neutral"];

function isSentiment(v: string): v is Sentiment {
  return v === "positive" || v === "neutral" || v === "negative";
}

/**
 * FR-149, BR-042 (#261): one row per configured term in setting order (`ord` is 1-based from `WITH ORDINALITY`),
 * zero-filled; `dominant`/`dominantShare` null when the term has no mentions. Unknown sentiments are ignored.
 */
export function toLandingTermRows(terms: readonly string[], cells: readonly LandingTermCell[]): LandingTermRow[] {
  return terms.map((term, i) => {
    const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const c of cells) if (c.ord === i + 1 && isSentiment(c.sentiment)) counts[c.sentiment] += c.count;
    const total = counts.positive + counts.neutral + counts.negative;
    let dominant: Sentiment | null = null;
    for (const s of DOMINANCE) if (counts[s] > 0 && (dominant === null || counts[s] > counts[dominant])) dominant = s;
    return {
      term,
      ...counts,
      total,
      dominant,
      dominantShare: dominant === null ? null : counts[dominant] / total,
    };
  });
}
