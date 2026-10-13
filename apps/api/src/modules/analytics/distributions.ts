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
