/** #333: phrase page vs the previous period. Pure helpers; counts are `sentimentAnalyzed` on both sides (metric §5). */

/** Window of the same length right before `[from, to)`, as UTC instants. */
export function previousWindow(from: string, to: string): { from: string; to: string } {
  const start = Date.parse(from);
  const span = Date.parse(to) - start;
  return { from: new Date(start - span).toISOString(), to: new Date(start).toISOString() };
}

export type ChangeState = "up" | "down" | "flat" | "new";

export interface TermSide {
  total: number;
  negative: number;
}

/** Growth with the metric §5 rule: previous 0 → "new"; |growth| < 0.005 → flat. */
export function termChange(current: TermSide, previous: TermSide) {
  const negShare = current.total > 0 ? current.negative / current.total : 0;
  const prevNegShare = previous.total > 0 ? previous.negative / previous.total : null;
  if (previous.total === 0) {
    return { state: "new" as ChangeState, pct: null, previousTotal: 0, negShare, prevNegShare };
  }
  const pct = (current.total - previous.total) / previous.total;
  const state: ChangeState = Math.abs(pct) < 0.005 ? "flat" : pct > 0 ? "up" : "down";
  return { state, pct, previousTotal: previous.total, negShare, prevNegShare };
}
