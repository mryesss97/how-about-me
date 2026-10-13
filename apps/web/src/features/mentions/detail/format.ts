export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
export const usd = (v: number | null | undefined) => (v == null ? "—" : `$${v.toFixed(4)}`);
