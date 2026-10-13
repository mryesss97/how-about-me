/** Splits text into plain/match segments for search highlighting (FR-158). Pure; no HTML is ever produced. */
export type Segment = { text: string; match: boolean };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function highlightSegments(text: string, query: string | null | undefined): Segment[] {
  const source = text.normalize("NFC");
  const terms = (query ?? "")
    .normalize("NFC")
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (terms.length === 0) return source ? [{ text: source, match: false }] : [];
  const re = new RegExp(`(${terms.join("|")})`, "giu");
  // With a capture group, odd indexes of `split` are the matches.
  return source
    .split(re)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}
