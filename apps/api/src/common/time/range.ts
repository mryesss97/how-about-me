/** Timezone-aware range helpers used by analytics — docs/01-product/07-metric-definitions.md §0, §5 (ADR-0011). */
export type Range = { from: Date; to: Date };

export function previousPeriod(r: Range): Range {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: new Date(r.from.getTime()) };
}

export function bucketInterval(r: Range): "hour" | "day" {
  return r.to.getTime() - r.from.getTime() <= 48 * 3600 * 1000 ? "hour" : "day";
}

export function rangeDays(r: Range): number {
  return (r.to.getTime() - r.from.getTime()) / 86_400_000;
}
