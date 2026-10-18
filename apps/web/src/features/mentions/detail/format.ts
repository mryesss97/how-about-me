/** Technical codes without a Vietnamese table (safety categories from the provider) — kept as humanised codes. */
export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
export const usd = (v: number | null | undefined) =>
  v == null ? "—" : `$${v.toLocaleString("vi-VN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

/**
 * Classifier model from an effective version `provider|model|prompt|taxonomy|safety.name|safety.model|policy`
 * (BR-023, docs/02-architecture/07-analysis-pipeline.md). Legacy values without `|` are returned as is (#344).
 */
export const runModel = (effectiveVersion: string): string => effectiveVersion.split("|")[1] || effectiveVersion;
