import type { PhraseSentimentResponse, TopicSentimentResponse } from "@how-about-me/contracts";

/**
 * Pure helpers for distribution endpoints (T-093) — docs/01-product/07-metric-definitions.md §3.2–3.6.
 */
export type LabelCount = { label: string; count: number };
export type DistributionItem<L extends string> = { label: L; count: number; share: number | null };

/** Max ranked topics before the `other` bucket (metric-definitions §3.5). */
export const TOP_TOPICS = 12;

export function share(count: number, denominator: number): number | null {
  return denominator > 0 ? count / denominator : null;
}

/** Every label in `labels` order with its count (0 when missing); share is null when denominator = 0 (FR-140). */
export function toDistribution<L extends string>(
  labels: readonly L[],
  rows: readonly LabelCount[],
  denominator: number,
): DistributionItem<L>[] {
  const counts = new Map(rows.map((r) => [r.label, r.count]));
  return labels.map((label) => {
    const count = counts.get(label) ?? 0;
    return { label, count, share: share(count, denominator) };
  });
}

/** Sort by count desc; ties keep the taxonomy order of `labels` (stable sort). */
export function sortByCountDesc<L extends string>(items: DistributionItem<L>[]): DistributionItem<L>[] {
  return [...items].sort((a, b) => b.count - a.count);
}

/**
 * Topics (decision 2026-10-13): rank real topic labels (taxonomy `other` excluded) by count desc, keep at most
 * `TOP_TOPICS`, then append the `other` bucket whose count is a DISTINCT post count computed in SQL
 * (posts tagged `other` or with a label outside the top) — never a sum of per-label counts.
 */
export function toTopicsDistribution<L extends string>(
  labels: readonly L[],
  topRows: readonly LabelCount[],
  otherCount: number,
  denominator: number,
): DistributionItem<L | "other">[] {
  const real = labels.filter((l) => l !== "other");
  const top = sortByCountDesc(toDistribution(real, topRows, denominator)).slice(0, TOP_TOPICS);
  return [...top, { label: "other", count: otherCount, share: share(otherCount, denominator) }];
}

export type TopicSentimentCount = { topic: string; sentiment: string; count: number };
type TopicSentimentRow = TopicSentimentResponse["rows"][number];

/**
 * FR-144, FR-140 — metric-definitions §4 Topic × sentiment. One row per taxonomy label (0 included); cells are
 * DISTINCT posts per (topic, sentiment); row total = positive + neutral + negative (= topicSentimentAnalyzed);
 * negativeShare null when total = 0. Unknown topics/sentiments are ignored. Sorted total desc, ties keep
 * taxonomy order, `other` (a real label here) last.
 */
export function toTopicSentimentRows<L extends TopicSentimentRow["topic"]>(
  labels: readonly L[],
  counts: readonly TopicSentimentCount[],
): TopicSentimentRow[] {
  const cells = new Map(labels.map((l) => [l as string, { positive: 0, neutral: 0, negative: 0 }]));
  for (const c of counts) {
    const cell = cells.get(c.topic);
    if (cell && (c.sentiment === "positive" || c.sentiment === "neutral" || c.sentiment === "negative")) {
      cell[c.sentiment] += c.count;
    }
  }
  const rows = labels.map((topic) => {
    const { positive, neutral, negative } = cells.get(topic) ?? { positive: 0, neutral: 0, negative: 0 };
    const total = positive + neutral + negative;
    return { topic, positive, neutral, negative, total, negativeShare: share(negative, total) };
  });
  return [...rows].sort((a, b) => {
    if (a.topic === "other") return 1;
    if (b.topic === "other") return -1;
    return b.total - a.total;
  });
}

export type PhraseSentimentCell = { phrase: string; sentiment: string; count: number };
export type PhraseSentimentCounts = {
  cells: PhraseSentimentCell[];
  sentimentAnalyzed: number;
  phraseAnalyzed: number;
  totalPhrases: number;
};
type PhraseSentimentRow = PhraseSentimentResponse["rows"][number];

/**
 * FR-148, FR-140 — metric-definitions §4 Phrase × sentiment. One row per phrase present in `cells`;
 * total = positive + neutral + negative; rows below `minMentions` dropped (defensive, SQL already filters);
 * sorted total desc then phrase by code point (matches SQL `COLLATE "C"`), cut at `limit`.
 */
export function toPhraseSentimentRows(
  cells: readonly PhraseSentimentCell[],
  opts: { limit: number; minMentions: number },
): PhraseSentimentRow[] {
  const byPhrase = new Map<string, { positive: number; neutral: number; negative: number }>();
  for (const c of cells) {
    if (c.sentiment !== "positive" && c.sentiment !== "neutral" && c.sentiment !== "negative") continue;
    const cell = byPhrase.get(c.phrase) ?? { positive: 0, neutral: 0, negative: 0 };
    cell[c.sentiment] += c.count;
    byPhrase.set(c.phrase, cell);
  }
  const rows = [...byPhrase].map(([phrase, { positive, neutral, negative }]) => {
    const total = positive + neutral + negative;
    return { phrase, positive, neutral, negative, total, negativeShare: share(negative, total) };
  });
  return rows
    .filter((r) => r.total >= opts.minMentions)
    .sort((a, b) => b.total - a.total || compareCodePoints(a.phrase, b.phrase))
    .slice(0, opts.limit);
}

/** Code-point order = UTF-8 byte order = SQL `COLLATE "C"` (JS `<` compares UTF-16 units, which differs past the BMP). */
export function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a, (c) => c.codePointAt(0) ?? 0);
  const y = Array.from(b, (c) => c.codePointAt(0) ?? 0);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return x.length - y.length;
}
